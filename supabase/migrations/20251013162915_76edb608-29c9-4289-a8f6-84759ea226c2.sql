-- Create allowed_users table for access control
CREATE TABLE public.allowed_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create prompts table
CREATE TABLE public.prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  order_index integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create images table
CREATE TABLE public.images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES public.prompts(id) ON DELETE CASCADE NOT NULL,
  model_name text NOT NULL,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create votes table for pairwise comparisons
CREATE TABLE public.votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES public.prompts(id) ON DELETE CASCADE NOT NULL,
  user_email text NOT NULL,
  left_image_id uuid REFERENCES public.images(id) ON DELETE CASCADE NOT NULL,
  right_image_id uuid REFERENCES public.images(id) ON DELETE CASCADE NOT NULL,
  winner_id uuid REFERENCES public.images(id) ON DELETE CASCADE,
  is_tie boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create rankings table for top-3 results
CREATE TABLE public.rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id uuid REFERENCES public.prompts(id) ON DELETE CASCADE NOT NULL,
  user_email text NOT NULL,
  first_id uuid REFERENCES public.images(id) ON DELETE CASCADE NOT NULL,
  second_id uuid REFERENCES public.images(id) ON DELETE CASCADE NOT NULL,
  third_id uuid REFERENCES public.images(id) ON DELETE CASCADE NOT NULL,
  rating_first decimal(3,1) NOT NULL CHECK (rating_first >= 1 AND rating_first <= 10),
  rating_second decimal(3,1) NOT NULL CHECK (rating_second >= 1 AND rating_second <= 10),
  rating_third decimal(3,1) NOT NULL CHECK (rating_third >= 1 AND rating_third <= 10),
  created_at timestamptz DEFAULT now(),
  UNIQUE(prompt_id, user_email)
);

-- Enable RLS
ALTER TABLE public.allowed_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for allowed_users (only for checking access)
CREATE POLICY "Anyone can check if email is allowed"
ON public.allowed_users FOR SELECT
USING (true);

-- RLS Policies for prompts (read-only)
CREATE POLICY "Anyone can view prompts"
ON public.prompts FOR SELECT
USING (true);

-- RLS Policies for images (read-only)
CREATE POLICY "Anyone can view images"
ON public.images FOR SELECT
USING (true);

-- RLS Policies for votes
CREATE POLICY "Anyone can insert votes"
ON public.votes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can view their own votes"
ON public.votes FOR SELECT
USING (true);

-- RLS Policies for rankings
CREATE POLICY "Anyone can insert rankings"
ON public.rankings FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view rankings"
ON public.rankings FOR SELECT
USING (true);

-- Insert sample allowed users
INSERT INTO public.allowed_users (email) VALUES
('demo@hvcapital.com'),
('test@hvcapital.com');

-- Insert sample prompts
INSERT INTO public.prompts (text, order_index) VALUES
('A group selfie of three friends of different ethnic backgrounds smiling at the camera.', 1),
('A portrait of a person with elaborate facial tattoos and piercings, shown in sharp detail.', 2),
('A bride on her wedding day, smiling with tears of joy in her eyes.', 3),
('A black and white close-up portrait of a freckled woman with an intense gaze.', 4);

-- Insert placeholder images for each prompt
-- Prompt 1 images
INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'OpenAI', 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 1;

INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'Midjourney', 'https://images.unsplash.com/photo-1543269865-4430c0ea78f2?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 1;

INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'Stable Diffusion', 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 1;

INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'GenPeach', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 1;

-- Prompt 2 images
INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'OpenAI', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 2;

INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'Midjourney', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 2;

INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'Stable Diffusion', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 2;

INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'GenPeach', 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 2;

-- Prompt 3 images
INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'OpenAI', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 3;

INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'Midjourney', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 3;

INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'Stable Diffusion', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 3;

INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'GenPeach', 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 3;

-- Prompt 4 images
INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'OpenAI', 'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 4;

INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'Midjourney', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 4;

INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'Stable Diffusion', 'https://images.unsplash.com/photo-1502323777036-f29e3972d82f?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 4;

INSERT INTO public.images (prompt_id, model_name, image_url)
SELECT id, 'GenPeach', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&h=800&fit=crop'
FROM public.prompts WHERE order_index = 4;