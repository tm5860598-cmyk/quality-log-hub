## المرحلة 2 — رفع الصور + QR + SOP + NCR

### 1. رفع صور المنتجات (Supabase Storage)

- إنشاء bucket `product-images` عام (public).
- سياسات RLS: قراءة للجميع، رفع/حذف للأدوار الإدارية (owner, admin, qa_manager, production_manager).
- في نموذج المنتج (تبويبة "الأساسي") — بدل حقل `image_url` النصي: زر رفع صورة → يحفظ الملف في bucket ويخزن الرابط العام في `products.image_url`.
- عرض الصورة في Card المنتج وفي Modal التفاصيل.

### 2. QR Code لكل منتج

- حزمة `qrcode` (توليد QR بدون uploads إضافية).
- في Modal تفاصيل المنتج: زر "عرض QR" يعرض QR يحتوي JSON مختصر:
  ```
  { code, name, category, size, batch: "-" }
  ```
- زر "طباعة ملصق" يطبع بطاقة A6 فيها: الاسم، الكود، النوع، الحجم، QR — للصق على العبوة.

### 3. توليد SOP/BMR (PDF)

- زر "توليد SOP" داخل صفحة المنتج.
- يبني ملف HTML منسق يحتوي:
  - Header: اسم المنتج، الكود، النوع، الحجم، الصورة، رقم الإصدار، التاريخ.
  - قسم "المواصفات القياسية" (pH, Brix, لزوجة، وزن، صلاحية، تخزين، حساسية).
  - قسم "الخامات" (جدول: الاسم، الكود، المورد، النسبة، الحدود، الكمية).
  - قسم "خطوات التصنيع" (جدول من `recipe.steps` مرتب: رقم الخطوة، الوصف، السرعة، الوقت، الحرارة، الضغط، ملاحظات).
  - قسم "بارامترات عامة" (pasteurization, cooling, filling, تعليمات خاصة).
  - Footer: توقيع مهندس الجودة/الإنتاج.
- التحويل لـ PDF عبر `html2pdf.js` (متاحة بالفعل).
- BMR: نفس القالب لكن بحقول فارغة قابلة للتعبئة اليدوية أثناء التصنيع (وزن فعلي، قراءات pH لكل خطوة، الملاحظات).

### 4. تقارير عدم مطابقة (NCR) + إجراءات تصحيحية (CAPA)

جدول جديد `ncr_reports`:

```
id, ncr_number (SERIAL), product_id (FK اختياري), category,
problem_description, root_cause, corrective_action, preventive_action,
severity (low/medium/high/critical), status (open/in_progress/closed),
opened_by, opened_at, closed_by, closed_at, closed_notes
```

- تبويبة جديدة في الـ Hub: "تقارير عدم المطابقة".
- الواجهة: قائمة NCRs مع فلترة بالحالة + زر "NCR جديد" يفتح نموذج (اختيار المنتج، وصف المشكلة، السبب الجذري، الإجراء التصحيحي، الوقائي، الخطورة).
- زر "إغلاق التقرير" بيسجل من أغلق ومتى + ملاحظات.
- RLS: يفتح NCR أي مستخدم authenticated، يعدل/يغلق فقط الأدوار الإدارية (qa_manager, admin, owner).

### تفاصيل تقنية

- Migration واحدة: bucket policies + `ncr_reports` + trigger `updated_at`.
- حزمة جديدة واحدة فقط: `qrcode`.
- كل التعديلات في صفحة المنتجات الحالية `products.$category.tsx` + صفحة NCR جديدة `ncr.tsx` + تبويبة في `index.tsx`.
- بقاء `html2pdf.js` هو محرك التصدير.

### ملفات هتتعدل / تتعمل

- Migration جديدة
- `src/routes/products.$category.tsx` (رفع صورة + QR + SOP + BMR)
- `src/routes/ncr.tsx` (جديد)
- `src/routes/index.tsx` (تبويبة NCR في الـ Hub)
- إعداد Storage bucket عبر أداة Lovable Cloud

أوافق أبدأ التنفيذ؟
