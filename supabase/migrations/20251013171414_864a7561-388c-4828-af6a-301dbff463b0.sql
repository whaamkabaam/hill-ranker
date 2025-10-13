-- ====================================================================================================
-- Phase 1: Database Schema Enhancement
-- ====================================================================================================

-- Add job_title column to profiles table
ALTER TABLE public.profiles ADD COLUMN job_title TEXT;

-- Update Felix Holtkamp's role to admin
UPDATE public.user_roles 
SET role = 'admin'::app_role 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'felix.holtkamp@me.com');

-- Set Felix's job title
UPDATE public.profiles 
SET job_title = 'Platform Administrator' 
WHERE email = 'felix.holtkamp@me.com';

-- Seed job titles for all HV Capital employees
UPDATE public.profiles
SET job_title = CASE email
  -- Investment Team Venture
  WHEN 'rainer.maerkle@hvcapital.com' THEN 'General Partner'
  WHEN 'david.kuczek@hvcapital.com' THEN 'General Partner'
  WHEN 'barbod.namini@hvcapital.com' THEN 'General Partner'
  WHEN 'lina.chong@hvcapital.com' THEN 'Partner'
  WHEN 'david.fischer@hvcapital.com' THEN 'Partner'
  WHEN 'felix.kluehr@hvcapital.com' THEN 'General Partner'
  WHEN 'maxi.pethoeschramm@hvcapital.com' THEN 'Principal'
  WHEN 'jan.miczaika@hvcapital.com' THEN 'Partner'
  WHEN 'laura.seifert@hvcapital.com' THEN 'Investment Manager'
  WHEN 'said.haschemi@hvcapital.com' THEN 'Principal'
  WHEN 'manal.belaouane@hvcapital.com' THEN 'Principal'
  WHEN 'emma.ubrig@hvcapital.com' THEN 'Analyst'
  WHEN 'frederic.kost@hvcapital.com' THEN 'Investment Manager'
  WHEN 'luisa.textor@hvcapital.com' THEN 'Analyst'
  WHEN 'jack.mcguinness@hvcapital.com' THEN 'Associate'
  -- Investment Team Growth
  WHEN 'christian.saller@hvcapital.com' THEN 'General Partner'
  WHEN 'alexander.jolcarbonell@hvcapital.com' THEN 'Investment Manager'
  WHEN 'mina.mutafchieva@hvcapital.com' THEN 'Partner | HV Capital Adviser UK'
  WHEN 'fabian.gruner@hvcapital.com' THEN 'Partner'
  WHEN 'jannis.fett@hvcapital.com' THEN 'Principal'
  WHEN 'annchristin.stiehl@hvcapital.com' THEN 'Investment Manager'
  WHEN 'lucian.rilling@hvcapital.com' THEN 'Analyst'
  WHEN 'vincent.coon@hvcapital.com' THEN 'Associate'
  -- Founding Partners
  WHEN 'christoph.jung@hvcapital.com' THEN 'Founding Partner'
  WHEN 'sven.achter@hvcapital.com' THEN 'Founding Partner'
  WHEN 'martin.weber@hvcapital.com' THEN 'Founding Partner'
  WHEN 'lars.langusch@hvcapital.com' THEN 'Founding Partner'
  -- Platform
  WHEN 'anna.ott@hvcapital.com' THEN 'VP People'
  WHEN 'kasey.davies@hvcapital.com' THEN 'VP Marketing'
  WHEN 'marie.bos@hvcapital.com' THEN 'VP of ESG'
  WHEN 'shannon.storch@hvcapital.com' THEN 'Marketing Manager'
  -- Operations
  WHEN 'carlota.gonzalez@hvcapital.com' THEN 'Front Office'
  WHEN 'magalie.karr@hvcapital.com' THEN 'Head of Office Management'
  WHEN 'christian.berktold@hvcapital.com' THEN 'Director Finance'
  WHEN 'karl.ehrenberg@hvcapital.com' THEN 'Legal Counsel'
  WHEN 'heiko.kottkampramann@hvcapital.com' THEN 'CFO'
  WHEN 'nicolas.clemm@hvcapital.com' THEN 'Chief of Staff'
  WHEN 'alexander.weidenhaus@hvcapital.com' THEN 'Director Finance'
  WHEN 'daniel.bertele@hvcapital.com' THEN 'Chief Risk Officer'
  WHEN 'andreas.wisser@hvcapital.com' THEN 'General Counsel'
  WHEN 'joscha.magerfleisch@hvcapital.com' THEN 'Director of Tax'
  WHEN 'luise.iglwefelscheid@hvcapital.com' THEN 'Finance Manager'
  WHEN 'natalia.pineda@hvcapital.com' THEN 'Finance Manager'
  WHEN 'tiangu.shum@hvcapital.com' THEN 'Senior Legal Counsel'
  WHEN 'laura.treubleinleu@hvcapital.com' THEN 'Senior Legal Counsel'
  WHEN 'kilian.gapp@hvcapital.com' THEN 'VP IT and Engineering'
  WHEN 'sandra.gaubatz@hvcapital.com' THEN 'Manager AML & Contracts'
  WHEN 'sybille.siebert@hvcapital.com' THEN 'Finance Manager'
  WHEN 'tanita.uzunova@hvcapital.com' THEN 'Director Finance'
  WHEN 'soufiane.hilali@hvcapital.com' THEN 'Finance Manager'
  WHEN 'ugur.cetinkaya@hvcapital.com' THEN 'Finance Manager'
  WHEN 'luisa.chianetta@hvcapital.com' THEN 'Accountant'
  WHEN 'eileen.shea@hvcapital.com' THEN 'Operations'
  WHEN 'kristin.kolb@hvcapital.com' THEN 'Portfolio Controlling Manager'
  WHEN 'wolfgang.reis@hvcapital.com' THEN 'Accountant'
  WHEN 'tina.lesko@hvcapital.com' THEN 'Director of Compliance, Operations & Risk'
  WHEN 'marianna.jaschke@hvcapital.com' THEN 'Senior Office Manager'
  WHEN 'martina.schulz@hvcapital.com' THEN 'Head of Business Intelligence'
  WHEN 'alec.eastman@hvcapital.com' THEN 'IT Specialist'
  WHEN 'sebastian.schulenberg@hvcapital.com' THEN 'Compliance, Operations & Risk Manager'
  ELSE job_title
END
WHERE email IN (
  'rainer.maerkle@hvcapital.com', 'david.kuczek@hvcapital.com', 'barbod.namini@hvcapital.com',
  'lina.chong@hvcapital.com', 'david.fischer@hvcapital.com', 'felix.kluehr@hvcapital.com',
  'maxi.pethoeschramm@hvcapital.com', 'jan.miczaika@hvcapital.com', 'laura.seifert@hvcapital.com',
  'said.haschemi@hvcapital.com', 'manal.belaouane@hvcapital.com', 'emma.ubrig@hvcapital.com',
  'frederic.kost@hvcapital.com', 'luisa.textor@hvcapital.com', 'jack.mcguinness@hvcapital.com',
  'christian.saller@hvcapital.com', 'alexander.jolcarbonell@hvcapital.com', 'mina.mutafchieva@hvcapital.com',
  'fabian.gruner@hvcapital.com', 'jannis.fett@hvcapital.com', 'annchristin.stiehl@hvcapital.com',
  'lucian.rilling@hvcapital.com', 'vincent.coon@hvcapital.com', 'christoph.jung@hvcapital.com',
  'sven.achter@hvcapital.com', 'martin.weber@hvcapital.com', 'lars.langusch@hvcapital.com',
  'anna.ott@hvcapital.com', 'kasey.davies@hvcapital.com', 'marie.bos@hvcapital.com',
  'shannon.storch@hvcapital.com', 'carlota.gonzalez@hvcapital.com', 'magalie.karr@hvcapital.com',
  'christian.berktold@hvcapital.com', 'karl.ehrenberg@hvcapital.com', 'heiko.kottkampramann@hvcapital.com',
  'nicolas.clemm@hvcapital.com', 'alexander.weidenhaus@hvcapital.com', 'daniel.bertele@hvcapital.com',
  'andreas.wisser@hvcapital.com', 'joscha.magerfleisch@hvcapital.com', 'luise.iglwefelscheid@hvcapital.com',
  'natalia.pineda@hvcapital.com', 'tiangu.shum@hvcapital.com', 'laura.treubleinleu@hvcapital.com',
  'kilian.gapp@hvcapital.com', 'sandra.gaubatz@hvcapital.com', 'sybille.siebert@hvcapital.com',
  'tanita.uzunova@hvcapital.com', 'soufiane.hilali@hvcapital.com', 'ugur.cetinkaya@hvcapital.com',
  'luisa.chianetta@hvcapital.com', 'eileen.shea@hvcapital.com', 'kristin.kolb@hvcapital.com',
  'wolfgang.reis@hvcapital.com', 'tina.lesko@hvcapital.com', 'marianna.jaschke@hvcapital.com',
  'martina.schulz@hvcapital.com', 'alec.eastman@hvcapital.com', 'sebastian.schulenberg@hvcapital.com'
);