CREATE TABLE public.departments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  title_ar text NOT NULL,
  title_en text NOT NULL DEFAULT '',
  desc_ar text NOT NULL DEFAULT '',
  desc_en text NOT NULL DEFAULT '',
  emoji text NOT NULL DEFAULT '🏭',
  gradient text NOT NULL DEFAULT 'from-slate-500 to-slate-700',
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departments_select_authenticated" ON public.departments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "departments_insert_owner" ON public.departments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin']));

CREATE POLICY "departments_update_owner" ON public.departments
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['owner','admin']));

CREATE POLICY "departments_delete_owner" ON public.departments
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin']) AND is_system = false);

CREATE TRIGGER departments_touch BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.departments (key, title_ar, title_en, desc_ar, desc_en, emoji, gradient, is_system, sort_order) VALUES
('juice-production','إنتاج العصائر','Juice Production','طرق تشغيل ووصفات العصائر بمعايير NFSA','Juice recipes & NFSA-grade processes','🥤','from-orange-500 to-rose-500', true, 10),
('juice-quality','جودة العصائر','Juice Quality','جميع اختبارات المعمل وصالة الإنتاج','All lab & floor QC tests','🧪','from-rose-500 to-fuchsia-500', true, 20),
('dairy-production','إنتاج الألبان','Dairy Production','تصنيع اللبن والزبادي والجبن والمعدات','Milk, yogurt, cheese processes','🥛','from-sky-500 to-cyan-500', true, 30),
('dairy-quality','جودة الألبان','Dairy Quality','تحاليل الدهن والبروتين والميكروبيولوجي','Fat, protein & micro tests','🔬','from-cyan-500 to-teal-500', true, 40),
('bakery-production','إنتاج البيكري','Bakery Production','وصفات المخبوزات وخطوات الإنتاج','Bakers percentages & steps','🥐','from-amber-500 to-orange-500', true, 50),
('bakery-quality','جودة البيكري','Bakery Quality','تحاليل الجلوتين والرطوبة وأجهزة المعمل','Gluten, moisture & lab kit','🧫','from-yellow-500 to-amber-500', true, 60),
('quality-reports','الجودة العام','General Quality','التقارير والمراجع وسجلات الجودة','Reports, references & quality records','📋','from-emerald-500 to-teal-600', true, 70),
('quality-reference','المراجع والمستندات','Reference Library','مكتبة مراجع عامة لكل أنواع الملفات','General reference library','📚','from-indigo-500 to-violet-600', true, 80);