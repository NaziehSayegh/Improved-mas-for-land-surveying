-- Function to register a new license (from Gumroad) into Supabase
create or replace function register_new_license(
  p_license_key text,
  p_email text,
  p_machine_id text
)
returns json
language plpgsql
security definer
as $$
declare
  v_license_id licenses.id%type;
  v_current_devices int;
begin
  -- 1. Insert the license if it doesn't exist
  insert into licenses (license_key, email, max_devices, created_at)
  values (p_license_key, p_email, 2, now())
  on conflict (license_key) do nothing;

  -- 2. Get the License ID
  select id into v_license_id from licenses where license_key = p_license_key;

  -- 3. Check device limit
  select count(*) into v_current_devices 
  from license_activations 
  where license_id = v_license_id;

  if v_current_devices >= 2 then
    -- Check if THIS machine is already one of them
    if not exists (select 1 from license_activations where license_id = v_license_id and machine_id = p_machine_id) then
       return json_build_object('success', false, 'message', 'Device limit reached (Max 2)');
    end if;
  end if;

  -- 4. Activate the device
  insert into license_activations (license_id, machine_id, activated_at)
  values (v_license_id, p_machine_id, now())
  on conflict (license_id, machine_id) do update
  set last_check_at = now();

  return json_build_object('success', true);
end;
$$;
