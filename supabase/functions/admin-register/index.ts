import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, password, full_name, phone, role, id_number, member_data } = await req.json();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (authError) throw authError;

    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      email,
      full_name,
      phone,
      role,
      id_number
    });
    if (profileError) throw profileError;

    // If role is member, create member record INCLUDING ALL FIELDS
    if (role === "member") {
      const { data: memberNumberData } = await supabase.rpc("generate_member_number");

      const { error: memberError } = await supabase.from("members").insert({
        profile_id: authData.user.id,
        member_number: memberNumberData,
        full_name: full_name,
        email: email,
        phone: phone,
        address: member_data?.address || null,
        date_of_birth: member_data?.date_of_birth || null,
        id_number: id_number,
        status: "active",
        account_balance: 0
      });
      if (memberError) throw memberError;
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: authData.user.id,
      email,
      id_number
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
