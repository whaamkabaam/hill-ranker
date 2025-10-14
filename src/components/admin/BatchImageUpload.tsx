import { useState, useCallback } from 'react';
import { Upload, X, Edit2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { parseModelNameFromFile } from '@/lib/modelNameParser';

interface UploadedFile {
  file: File;
  preview: string;
  detectedModelName: string;
  customModelName: string;
  uploadProgress: number;
  uploadStatus: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

interface BatchImageUploadProps {
  promptId: string;
  onUploadComplete: () => void;
}

export function BatchImageUpload({ promptId, onUploadComplete }: BatchImageUploadProps) {
  const [uploadFiles, setUploadFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFiles = useCallback((files: FileList) => {
    const fileArray = Array.from(files);
    
    // Validate file count
    if (uploadFiles.length + fileArray.length > 15) {
      toast({
        title: "Too many files",
        description: "You can only upload up to 15 images at once",
        variant: "destructive",
      });
      return;
    }

    // Validate and process files
    const validFiles: UploadedFile[] = [];
    
    fileArray.forEach(file => {
      // Check file type
      if (!file.type.match(/^image\/(webp|png|jpeg|jpg)$/)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a valid image format (webp, png, jpg)`,
          variant: "destructive",
        });
        return;
      }

      // Check file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 5MB limit`,
          variant: "destructive",
        });
        return;
      }

      const detectedName = parseModelNameFromFile(file.name);
      validFiles.push({
        file,
        preview: URL.createObjectURL(file),
        detectedModelName: detectedName,
        customModelName: detectedName,
        uploadProgress: 0,
        uploadStatus: 'pending',
      });
    });

    setUploadFiles(prev => [...prev, ...validFiles]);
    
    if (validFiles.length > 0) {
      toast({
        title: "Files added",
        description: `${validFiles.length} image(s) ready to upload`,
      });
    }
  }, [uploadFiles.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = useCallback((index: number) => {
    setUploadFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  }, []);

  const removeAll = useCallback(() => {
    uploadFiles.forEach(f => URL.revokeObjectURL(f.preview));
    setUploadFiles([]);
  }, [uploadFiles]);

  const updateModelName = useCallback((index: number, newName: string) => {
    setUploadFiles(prev => 
      prev.map((f, i) => i === index ? { ...f, customModelName: newName } : f)
    );
  }, []);

  const handleUploadAll = async () => {
    if (!promptId) {
      toast({
        title: "No prompt selected",
        description: "Please select a prompt first",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < uploadFiles.length; i++) {
      const uploadFile = uploadFiles[i];
      
      try {
        // Update status to uploading
        setUploadFiles(prev => 
          prev.map((f, idx) => idx === i ? { ...f, uploadStatus: 'uploading' as const } : f)
        );

        // Generate unique filename
        const fileExt = uploadFile.file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        // Upload to storage
        const { data: storageData, error: storageError } = await supabase.storage
          .from('prompt-images')
          .upload(fileName, uploadFile.file, {
            cacheControl: '3600',
            upsert: false
          });

        if (storageError) throw storageError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('prompt-images')
          .getPublicUrl(fileName);

        // Save to database
        const { error: dbError } = await supabase
          .from('images')
          .insert({
            prompt_id: promptId,
            model_name: uploadFile.customModelName,
            image_url: publicUrl,
            is_active: true,
            is_placeholder: false,
          });

        if (dbError) throw dbError;

        // Update status to success
        setUploadFiles(prev => 
          prev.map((f, idx) => idx === i 
            ? { ...f, uploadStatus: 'success' as const, uploadProgress: 100 } 
            : f
          )
        );
        
        successCount++;
      } catch (error) {
        console.error('Upload error:', error);
        errorCount++;
        
        setUploadFiles(prev => 
          prev.map((f, idx) => idx === i 
            ? { 
                ...f, 
                uploadStatus: 'error' as const, 
                errorMessage: error instanceof Error ? error.message : 'Upload failed' 
              } 
            : f
          )
        );
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast({
        title: "Upload complete",
        description: `${successCount} image(s) uploaded successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      });
      
      // Clear successful uploads after a delay
      setTimeout(() => {
        setUploadFiles(prev => prev.filter(f => f.uploadStatus !== 'success'));
        onUploadComplete();
      }, 2000);
    } else {
      toast({
        title: "Upload failed",
        description: "All uploads failed. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging ? 'border-primary bg-primary/5' : 'border-border'}
          ${uploadFiles.length >= 15 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}
        `}
      >
        <input
          type="file"
          id="file-upload"
          multiple
          accept="image/webp,image/png,image/jpeg,image/jpg"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          disabled={uploadFiles.length >= 15}
        />
        <label 
          htmlFor="file-upload" 
          className={`flex flex-col items-center gap-2 ${uploadFiles.length >= 15 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <Upload className="w-12 h-12 text-muted-foreground" />
          <div>
            <p className="text-lg font-medium">Drop images here or click to browse</p>
            <p className="text-sm text-muted-foreground mt-1">
              Max 15 images • WebP, PNG, or JPG • Max 5MB each
            </p>
            <p className="text-sm text-muted-foreground">
              Files uploaded: {uploadFiles.length}/15
            </p>
          </div>
        </label>
      </div>

      {/* File List */}
      {uploadFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Ready to Upload ({uploadFiles.length})</h3>
            <Button variant="ghost" size="sm" onClick={removeAll} disabled={isUploading}>
              Remove All
            </Button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {uploadFiles.map((uploadFile, index) => (
              <div 
                key={index} 
                className="flex items-center gap-3 p-3 border rounded-lg bg-card"
              >
                {/* Thumbnail */}
                <img 
                  src={uploadFile.preview} 
                  alt={uploadFile.file.name}
                  className="w-16 h-16 object-cover rounded"
                />

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{uploadFile.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(uploadFile.file.size / 1024).toFixed(1)} KB
                  </p>
                  
                  {/* Model Name - Editable */}
                  <div className="flex items-center gap-2 mt-1">
                    {editingIndex === index ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={uploadFile.customModelName}
                          onChange={(e) => updateModelName(index, e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') setEditingIndex(null);
                            if (e.key === 'Escape') {
                              updateModelName(index, uploadFile.detectedModelName);
                              setEditingIndex(null);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setEditingIndex(null)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-primary font-medium">
                          {uploadFile.customModelName}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => setEditingIndex(index)}
                          disabled={isUploading}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Progress */}
                  {uploadFile.uploadStatus === 'uploading' && (
                    <Progress value={uploadFile.uploadProgress} className="mt-2 h-1" />
                  )}
                  
                  {/* Error Message */}
                  {uploadFile.uploadStatus === 'error' && (
                    <p className="text-xs text-destructive mt-1">{uploadFile.errorMessage}</p>
                  )}
                </div>

                {/* Status Icon */}
                <div className="flex items-center gap-2">
                  {uploadFile.uploadStatus === 'success' && (
                    <Check className="h-5 w-5 text-green-500" />
                  )}
                  {uploadFile.uploadStatus === 'error' && (
                    <X className="h-5 w-5 text-destructive" />
                  )}
                  {uploadFile.uploadStatus === 'pending' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => removeFile(index)}
                      disabled={isUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Upload Button */}
          <Button 
            onClick={handleUploadAll} 
            disabled={isUploading || uploadFiles.length === 0}
            className="w-full"
          >
            {isUploading ? 'Uploading...' : `Upload All (${uploadFiles.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}
