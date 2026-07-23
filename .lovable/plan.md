## المرحلة 1 — الأساس

### 1. توسيع جدول `products`

أضيف أعمدة جديدة على الجدول الموجود بدون كسر البيانات الحالية:

- `code` (كود المنتج، فريد لكل قسم)
- `product_type` (نوع)
- `package_size` (حجم العبوة)
- `image_url` (صورة)
- `spec` JSONB يحتوي: `ph`, `brix`, `viscosity`, `net_weight`, `shelf_life`, `storage`, `allergens[]`, `standard_spec`
- `recipe` JSONB (وصفة التصنيع، تفصيل تحت)

الحقول القديمة (`ingredients`, `base_quantity`, `notes`) تبقى كما هي.

### 2. تركيبة الخامات الجديدة

كل عنصر في `ingredients[]` هيبقى:

```
{ name, code, supplier, percentage, min_percent, max_percent,
  standard_spec, cost, expiry_date, storage_conditions,
  quantity, unit }
```

الحاسبة الحالية بتضرب `quantity`، فتبقى شغالة. الحقول الإضافية اختيارية.

### 3. الوصفة (Recipe)

`recipe` JSONB = `{ steps: [...], parameters: {...} }` حيث كل step:

```
{ order, ingredient_ref, quantity, stir_speed, stir_time,
  temperature, pressure, notes }
```

`parameters`: `pasteurization_time`, `cooling_time`, `filling_point`, `special_instructions`.

### 4. نظام الصلاحيات

توسيع enum `app_role` بالأدوار:

```
owner, admin, qa_manager, production_manager,
qa_engineer, production_engineer, laboratory,
maintenance, warehouse, viewer, user
```

`owner` يبقى صاحب المشروع (طارق). واجهة "إدارة المستخدمين" الحالية تتوسع لتشمل: إضافة مستخدم بأي دور، وتغيير دور مستخدم موجود.

RLS على المنتجات: يقرأ الكل (authenticated)؛ يعدّل/يضيف: `admin`, `qa_manager`, `production_manager`, `owner` فقط؛ يحذف: `owner` أو `admin`. باقي الأدوار view فقط. أضيف دالة `has_any_role()`.

### 5. واجهة صفحة المنتجات `/products/$category`

نموذج الإضافة/التعديل يبقى تبويبات:

1. **الأساسي**: اسم، كود، نوع، حجم عبوة، صورة (URL)، وصف
2. **المواصفات القياسية**: pH, Brix, لزوجة, وزن صافي, صلاحية, تخزين, حساسية
3. **الخامات**: جدول ديناميكي بأعمدة الخامة الجديدة
4. **الوصفة**: قائمة خطوات مرتبة + بارامترات عامة

الحاسبة والبحث الحاليان يفضلوا يشتغلوا. Card المنتج يعرض الصورة والكود والنوع، وزرار "عرض التفاصيل" يفتح جميع المواصفات والوصفة في modal منسق.

### تفاصيل تقنية

- Migration واحدة: `ALTER TABLE products ADD COLUMN ...`، `ALTER TYPE app_role ADD VALUE ...`، `CREATE FUNCTION has_any_role`، تحديث RLS policies.
- الحقول القديمة في `ingredients` تتقرأ كما هي؛ الجديدة optional.
- Zod validation client-side على النموذج بالكامل.
- الصورة: `image_url` نصي (رابط) — رفع الصور لـ Supabase Storage يتأجل لمرحلة لاحقة عشان ما نطولش.

### ملفات هتتعدل

- Migration جديدة (schema + roles + policies)
- `src/routes/products.$category.tsx` (نموذج تبويبات + عرض تفاصيل)
- `src/routes/index.tsx` (تبويبة إدارة المستخدمين: dropdown أدوار)

### مش داخل المرحلة دي (هتيجي بعدين)

مساعد التصنيع الذكي، توليد SOP/BMR، شاشات المراقبة، NCR/CAPA، Dashboard، تقارير PDF/Excel، QR/Barcode، رفع صور، Audit trail، Dark mode. كلها مراحل لاحقة حسب اختيارك.

أوافق أبدأ التنفيذ؟