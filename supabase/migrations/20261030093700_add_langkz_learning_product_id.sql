alter table public.learning_review_items
  drop constraint if exists learning_review_items_product_id_check;

alter table public.learning_review_items
  add constraint learning_review_items_product_id_check
  check (product_id = any (array[
    'grammar'::text,
    'vocabulary'::text,
    'deutsch'::text,
    'arabic'::text,
    'japanese'::text,
    'langkz'::text,
    'other'::text
  ]));
