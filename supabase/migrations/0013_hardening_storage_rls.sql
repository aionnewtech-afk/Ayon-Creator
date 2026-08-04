-- Sprint de Hardening — Missão H1 (item 5.1, docs/hardening-plan.md). As 3
-- policies de storage.objects criadas em 0001_init.sql usavam `for all`
-- gated só por `is_org_member` — isso permitia que um usuário `viewer`
-- (papel pensado como só-leitura) enviasse/sobrescrevesse/apagasse arquivos
-- diretamente via API do Supabase Storage, contornando o
-- `hasMinimumRole(..., "editor")` que hoje só existe na camada de Server
-- Action, nunca no banco. Substituídas por policies separadas por operação:
-- select continua is_org_member (leitura para qualquer membro), escrita
-- (insert/update/delete) passa a exigir is_org_editor.

drop policy "brand_media_org_access" on storage.objects;
drop policy "knowledge_base_org_access" on storage.objects;
drop policy "content_output_org_access" on storage.objects;

-- brand-media -----------------------------------------------------------
create policy "brand_media_select_members"
  on storage.objects for select
  using (
    bucket_id = 'brand-media'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "brand_media_write_editors"
  on storage.objects for insert
  with check (
    bucket_id = 'brand-media'
    and public.is_org_editor((storage.foldername(name))[1]::uuid)
  );

create policy "brand_media_update_editors"
  on storage.objects for update
  using (
    bucket_id = 'brand-media'
    and public.is_org_editor((storage.foldername(name))[1]::uuid)
  );

create policy "brand_media_delete_editors"
  on storage.objects for delete
  using (
    bucket_id = 'brand-media'
    and public.is_org_editor((storage.foldername(name))[1]::uuid)
  );

-- knowledge-base ----------------------------------------------------------
create policy "knowledge_base_select_members"
  on storage.objects for select
  using (
    bucket_id = 'knowledge-base'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "knowledge_base_write_editors"
  on storage.objects for insert
  with check (
    bucket_id = 'knowledge-base'
    and public.is_org_editor((storage.foldername(name))[1]::uuid)
  );

create policy "knowledge_base_update_editors"
  on storage.objects for update
  using (
    bucket_id = 'knowledge-base'
    and public.is_org_editor((storage.foldername(name))[1]::uuid)
  );

create policy "knowledge_base_delete_editors"
  on storage.objects for delete
  using (
    bucket_id = 'knowledge-base'
    and public.is_org_editor((storage.foldername(name))[1]::uuid)
  );

-- content-output ----------------------------------------------------------
create policy "content_output_select_members"
  on storage.objects for select
  using (
    bucket_id = 'content-output'
    and public.is_org_member((storage.foldername(name))[1]::uuid)
  );

create policy "content_output_write_editors"
  on storage.objects for insert
  with check (
    bucket_id = 'content-output'
    and public.is_org_editor((storage.foldername(name))[1]::uuid)
  );

create policy "content_output_update_editors"
  on storage.objects for update
  using (
    bucket_id = 'content-output'
    and public.is_org_editor((storage.foldername(name))[1]::uuid)
  );

create policy "content_output_delete_editors"
  on storage.objects for delete
  using (
    bucket_id = 'content-output'
    and public.is_org_editor((storage.foldername(name))[1]::uuid)
  );
