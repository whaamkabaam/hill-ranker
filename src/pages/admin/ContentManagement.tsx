import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Plus, CheckCircle, XCircle, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Prompt {
  id: string;
  text: string;
  order_index: number;
  is_active: boolean;
  is_placeholder: boolean;
}

interface Image {
  id: string;
  prompt_id: string;
  model_name: string;
  image_url: string;
  is_active: boolean;
  is_placeholder: boolean;
}

export default function ContentManagement() {
  const navigate = useNavigate();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [newPromptText, setNewPromptText] = useState('');
  const [newPromptOrder, setNewPromptOrder] = useState(1);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [newImageModel, setNewImageModel] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      const [promptsRes, imagesRes] = await Promise.all([
        supabase.from('prompts').select('*').order('order_index'),
        supabase.from('images').select('*').order('created_at')
      ]);

      if (promptsRes.error) throw promptsRes.error;
      if (imagesRes.error) throw imagesRes.error;

      setPrompts(promptsRes.data || []);
      setImages(imagesRes.data || []);
    } catch (error) {
      console.error('Error loading content:', error);
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPrompt = async () => {
    if (!newPromptText.trim()) {
      toast.error('Prompt text is required');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('prompts').insert({
        text: newPromptText,
        order_index: newPromptOrder,
        is_active: false,
        is_placeholder: false,
        uploaded_by: user.id
      });

      if (error) throw error;

      toast.success('Prompt added successfully');
      setNewPromptText('');
      setNewPromptOrder(newPromptOrder + 1);
      loadContent();
    } catch (error) {
      console.error('Error adding prompt:', error);
      toast.error('Failed to add prompt');
    }
  };

  const handleTogglePromptActive = async (promptId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('prompts')
        .update({ is_active: !currentState })
        .eq('id', promptId);

      if (error) throw error;

      toast.success(`Prompt ${!currentState ? 'activated' : 'deactivated'}`);
      loadContent();
    } catch (error) {
      console.error('Error toggling prompt:', error);
      toast.error('Failed to toggle prompt');
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    try {
      // Delete associated images first
      await supabase.from('images').delete().eq('prompt_id', promptId);
      
      // Delete the prompt
      const { error } = await supabase.from('prompts').delete().eq('id', promptId);

      if (error) throw error;

      toast.success('Prompt and associated images deleted');
      loadContent();
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast.error('Failed to delete prompt');
    }
  };

  const handleAddImage = async () => {
    if (!selectedPromptId || !newImageModel.trim() || !newImageUrl.trim()) {
      toast.error('All fields are required');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from('images').insert({
        prompt_id: selectedPromptId,
        model_name: newImageModel,
        image_url: newImageUrl,
        is_active: true,
        is_placeholder: false,
        uploaded_by: user.id
      });

      if (error) throw error;

      toast.success('Image added successfully');
      setNewImageModel('');
      setNewImageUrl('');
      loadContent();
    } catch (error) {
      console.error('Error adding image:', error);
      toast.error('Failed to add image');
    }
  };

  const handleToggleImageActive = async (imageId: string, currentState: boolean) => {
    try {
      const { error } = await supabase
        .from('images')
        .update({ is_active: !currentState })
        .eq('id', imageId);

      if (error) throw error;

      toast.success(`Image ${!currentState ? 'activated' : 'deactivated'}`);
      loadContent();
    } catch (error) {
      console.error('Error toggling image:', error);
      toast.error('Failed to toggle image');
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      const { error } = await supabase.from('images').delete().eq('id', imageId);

      if (error) throw error;

      toast.success('Image deleted');
      loadContent();
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image');
    }
  };

  const handleCleanupPlaceholders = async () => {
    try {
      // Mark all placeholders as inactive
      await Promise.all([
        supabase.from('prompts').update({ is_active: false }).eq('is_placeholder', true),
        supabase.from('images').update({ is_active: false }).eq('is_placeholder', true)
      ]);

      toast.success('All placeholder content deactivated');
      loadContent();
    } catch (error) {
      console.error('Error cleaning placeholders:', error);
      toast.error('Failed to cleanup placeholders');
    }
  };

  const getImageCountForPrompt = (promptId: string) => {
    return images.filter(img => img.prompt_id === promptId && img.is_active).length;
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  const placeholderCount = prompts.filter(p => p.is_placeholder).length + images.filter(i => i.is_placeholder).length;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Content Management</h1>
            <p className="text-muted-foreground">Manage prompts and images for voting</p>
          </div>
          <div className="flex gap-2">
            {placeholderCount > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">
                    Clean Placeholders ({placeholderCount})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deactivate Placeholder Content?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will deactivate {placeholderCount} placeholder items. They won't be deleted but will be hidden from users.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCleanupPlaceholders}>
                      Deactivate Placeholders
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={() => navigate('/admin')}>Back to Admin</Button>
          </div>
        </div>

        <Tabs defaultValue="prompts">
          <TabsList>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
          </TabsList>

          <TabsContent value="prompts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Add New Prompt</CardTitle>
                <CardDescription>Create a new prompt for image comparison</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="prompt-text">Prompt Text</Label>
                    <Input
                      id="prompt-text"
                      value={newPromptText}
                      onChange={(e) => setNewPromptText(e.target.value)}
                      placeholder="Enter prompt text..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="prompt-order">Order Index</Label>
                    <Input
                      id="prompt-order"
                      type="number"
                      value={newPromptOrder}
                      onChange={(e) => setNewPromptOrder(parseInt(e.target.value))}
                    />
                  </div>
                  <Button onClick={handleAddPrompt} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Prompt
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              {prompts.map((prompt) => {
                const imageCount = getImageCountForPrompt(prompt.id);
                return (
                  <Card key={prompt.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={prompt.is_active ? "default" : "secondary"}>
                              {prompt.is_active ? "Active" : "Inactive"}
                            </Badge>
                            {prompt.is_placeholder && (
                              <Badge variant="outline">Placeholder</Badge>
                            )}
                            <Badge variant={imageCount === 4 ? "default" : "destructive"}>
                              {imageCount}/4 Images
                            </Badge>
                          </div>
                          <p className="font-medium">{prompt.text}</p>
                          <p className="text-sm text-muted-foreground">Order: {prompt.order_index}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={prompt.is_active ? "outline" : "default"}
                            onClick={() => handleTogglePromptActive(prompt.id, prompt.is_active)}
                          >
                            {prompt.is_active ? (
                              <XCircle className="w-4 h-4" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Prompt?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the prompt and all associated images.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeletePrompt(prompt.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="images" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Add New Image</CardTitle>
                <CardDescription>Upload an image for a prompt (ensure 4 images per prompt)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="image-prompt">Select Prompt</Label>
                    <select
                      id="image-prompt"
                      className="w-full p-2 border rounded-md"
                      value={selectedPromptId}
                      onChange={(e) => setSelectedPromptId(e.target.value)}
                    >
                      <option value="">Select a prompt...</option>
                      {prompts.map((prompt) => (
                        <option key={prompt.id} value={prompt.id}>
                          {prompt.text} ({getImageCountForPrompt(prompt.id)}/4)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="image-model">Model Name</Label>
                    <Input
                      id="image-model"
                      value={newImageModel}
                      onChange={(e) => setNewImageModel(e.target.value)}
                      placeholder="e.g., DALL-E 3, Midjourney v6"
                    />
                  </div>
                  <div>
                    <Label htmlFor="image-url">Image URL</Label>
                    <Input
                      id="image-url"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <Button onClick={handleAddImage} className="gap-2">
                    <Upload className="w-4 h-4" />
                    Add Image
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {images.map((image) => {
                const prompt = prompts.find(p => p.id === image.prompt_id);
                return (
                  <Card key={image.id}>
                    <CardContent className="pt-6 space-y-4">
                      <img
                        src={image.image_url}
                        alt={image.model_name}
                        className="w-full h-48 object-cover rounded-md"
                      />
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={image.is_active ? "default" : "secondary"}>
                            {image.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {image.is_placeholder && (
                            <Badge variant="outline">Placeholder</Badge>
                          )}
                        </div>
                        <p className="font-medium text-sm">{image.model_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {prompt?.text || 'Unknown prompt'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={image.is_active ? "outline" : "default"}
                          onClick={() => handleToggleImageActive(image.id, image.is_active)}
                          className="flex-1"
                        >
                          {image.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Image?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this image.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteImage(image.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}