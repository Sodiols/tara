
begin;

update public.categories
   set name_en = 'Ready Three Piece'
 where slug = 'three-piece'
   and name_en is distinct from 'Ready Three Piece';

commit;
