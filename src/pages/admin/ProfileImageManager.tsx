import { useState, useCallback, useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Check, AlertCircle, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UploadItem {
  file: File;
  preview: string;
  extractedEmail: string;
  matchedProfile?: {
    id: string;
    email: string;
    full_name: string;
    job_title?: string;
  };
  manualEmail?: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string;
  job_title?: string;
  profile_image_url?: string;
}

const ProfileImageManager = () => {
  const { isAdmin, loading } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [existingProfiles, setExistingProfiles] = useState<Profile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/dashboard');
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    fetchExistingProfiles();
  }, []);

  const fetchExistingProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, job_title, profile_image_url')
      .order('full_name');

    if (!error && data) {
      setExistingProfiles(data);
    }
  };

  const extractEmailFromFilename = (filename: string): string => {
    // Remove extension
    const nameWithoutExt = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '');
    
    // Split by underscore
    const parts = nameWithoutExt.split('_');
    
    // Normalize each part: remove hyphens and handle special characters
    const processedParts = parts.map(part => 
      part.toLowerCase()
        // Remove hyphens and special punctuation
        .replace(/[-]/g, '')
        // Normalize accented characters (decompose then remove diacritics)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        // Additional explicit replacements for safety
        .replace(/ö/g, 'o')
        .replace(/ü/g, 'u')
        .replace(/ä/g, 'a')
        .replace(/ë/g, 'e')
        .replace(/ï/g, 'i')
        .replace(/ø/g, 'o')
    );
    
    // Join with dot and append domain
    return `${processedParts.join('.')}@hvcapital.com`;
  };

  const findMatchingProfile = async (email: string): Promise<Profile | undefined> => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, full_name, job_title, profile_image_url')
      .eq('email', email)
      .maybeSingle();

    return data || undefined;
  };

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file => {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const maxSize = 5 * 1024 * 1024; // 5MB
      
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported image format`,
          variant: "destructive",
        });
        return false;
      }
      
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 5MB limit`,
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    });

    const newItems: UploadItem[] = await Promise.all(
      validFiles.map(async (file) => {
        const preview = URL.createObjectURL(file);
        const extractedEmail = extractEmailFromFilename(file.name);
        const matchedProfile = await findMatchingProfile(extractedEmail);
        
        return {
          file,
          preview,
          extractedEmail,
          matchedProfile,
          status: 'pending' as const,
        };
      })
    );

    setUploadItems(prev => [...prev, ...newItems]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeItem = (index: number) => {
    setUploadItems(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateManualEmail = async (index: number, email: string) => {
    const matchedProfile = await findMatchingProfile(email);
    setUploadItems(prev => prev.map((item, i) => 
      i === index ? { ...item, manualEmail: email, matchedProfile } : item
    ));
  };

  const uploadImages = async () => {
    setIsUploading(true);
    
    for (let i = 0; i < uploadItems.length; i++) {
      const item = uploadItems[i];
      const targetEmail = item.manualEmail || item.extractedEmail;
      const profile = item.matchedProfile;

      if (!profile) {
        setUploadItems(prev => prev.map((it, idx) => 
          idx === i ? { ...it, status: 'error', error: 'No matching profile found' } : it
        ));
        continue;
      }

      setUploadItems(prev => prev.map((it, idx) => 
        idx === i ? { ...it, status: 'uploading' } : it
      ));

      try {
        // Upload to storage
        const fileExt = item.file.name.split('.').pop();
        const fileName = `${profile.id}_${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('profile-images')
          .upload(fileName, item.file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('profile-images')
          .getPublicUrl(fileName);

        // Update profile
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ profile_image_url: publicUrl })
          .eq('id', profile.id);

        if (updateError) throw updateError;

        setUploadItems(prev => prev.map((it, idx) => 
          idx === i ? { ...it, status: 'success' } : it
        ));
      } catch (error: any) {
        setUploadItems(prev => prev.map((it, idx) => 
          idx === i ? { ...it, status: 'error', error: error.message } : it
        ));
      }
    }

    setIsUploading(false);
    toast({
      title: "Upload complete",
      description: "Profile images have been updated",
    });
    
    // Refresh existing profiles
    fetchExistingProfiles();
  };

  const deleteProfileImage = async (profile: Profile) => {
    if (!profile.profile_image_url) return;

    try {
      // Extract filename from URL
      const urlParts = profile.profile_image_url.split('/');
      const fileName = urlParts[urlParts.length - 1];

      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('profile-images')
        .remove([fileName]);

      if (deleteError) throw deleteError;

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_image_url: null })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      toast({
        title: "Image deleted",
        description: `Removed profile image for ${profile.full_name}`,
      });

      fetchExistingProfiles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Profile Image Manager</h1>
            <p className="text-muted-foreground mt-2">
              Bulk upload team member profile pictures
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/admin')}>
            Back to Admin
          </Button>
        </div>

        {/* Upload Section */}
        <Card className="p-8">
          <h2 className="text-xl font-semibold mb-4">Upload Images</h2>
          
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg mb-2">Drag & drop images here</p>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse (JPG, PNG, WEBP - Max 5MB each)
            </p>
            <Input
              type="file"
              multiple
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
              id="file-upload"
            />
            <Label htmlFor="file-upload">
              <Button variant="outline" asChild>
                <span>Browse Files</span>
              </Button>
            </Label>
          </div>

          {/* Upload Queue */}
          {uploadItems.length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  Upload Queue ({uploadItems.length})
                </h3>
                <Button
                  onClick={uploadImages}
                  disabled={isUploading || uploadItems.some(i => !i.matchedProfile && !i.manualEmail)}
                >
                  Upload All
                </Button>
              </div>

              {uploadItems.map((item, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start gap-4">
                    <img
                      src={item.preview}
                      alt="Preview"
                      className="w-20 h-20 object-cover rounded"
                    />
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{item.file.name}</p>
                        {item.status === 'success' && <Check className="w-4 h-4 text-green-500" />}
                        {item.status === 'error' && <AlertCircle className="w-4 h-4 text-destructive" />}
                      </div>
                      
                      <div className="space-y-1">
                        <p className="text-sm">
                          Extracted: <span className="font-mono">{item.extractedEmail}</span>
                        </p>
                        {item.matchedProfile ? (
                          <p className="text-sm text-green-600">
                            ✓ Matched: {item.matchedProfile.full_name} ({item.matchedProfile.email})
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-amber-600">⚠ No match found</p>
                            <Input
                              placeholder="Enter email manually"
                              value={item.manualEmail || ''}
                              onChange={(e) => updateManualEmail(index, e.target.value)}
                              className="max-w-sm"
                            />
                          </div>
                        )}
                        {item.error && (
                          <p className="text-sm text-destructive">{item.error}</p>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      disabled={isUploading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>

        {/* Existing Profiles */}
        <Card className="p-8">
          <h2 className="text-xl font-semibold mb-4">Existing Profile Images</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {existingProfiles
              .filter(p => p.profile_image_url)
              .map(profile => (
                <Card key={profile.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <img
                      src={profile.profile_image_url}
                      alt={profile.full_name}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{profile.full_name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {profile.job_title || 'No title'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {profile.email}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteProfileImage(profile)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
          </div>

          {existingProfiles.filter(p => p.profile_image_url).length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              No profile images uploaded yet
            </p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ProfileImageManager;
