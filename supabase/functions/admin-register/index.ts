import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { email, password, full_name, phone, role, id_number, member_data, user_id } = await req.json();

    let currentUserId = user_id;

    // If user_id is not provided, create a new user
    if (!currentUserId) {
      // ✅ Step 1: Check if user exists
      const { data: existingUserData, error: existingUserError } = await supabase.auth.admin.listUsers();
      if (existingUserError) throw existingUserError;

      const existingUser = existingUserData.users.find((u) => u.email === email);

      if (existingUser) {
        currentUserId = existingUser.id;
      } else {
        // ✅ Step 2: Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        });
        if (authError) throw authError;
        currentUserId = authData.user.id;
      }
    }

    // ✅ Step 3: Check or create profile
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", currentUserId)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: currentUserId,
        email,
        full_name,
        phone,
        role,
        id_number,
        address: member_data?.address || null,
        date_of_birth: member_data?.date_of_birth || null
      });
      if (profileError) throw profileError;
    } else {
      // ✅ Update profile if user_id exists (edit)
      await supabase.from("profiles").update({
        full_name,
        phone,
        id_number,
        address: member_data?.address || null,
        date_of_birth: member_data?.date_of_birth || null
      }).eq("id", currentUserId);
    }

    // ✅ Step 4: Only create a member if not existing
    if (role === "member") {
      const { data: existingMember } = await supabase
        .from("members")
        .select("id")
        .eq("profile_id", currentUserId)
        .maybeSingle();

      if (!existingMember) {
        const { data: memberNumberData } = await supabase.rpc("generate_member_number");

        const { error: memberError } = await supabase.from("members").insert({
          profile_id: currentUserId,
          member_number: memberNumberData,
          full_name,
          email,
          phone,
          address: member_data?.address || null,
          date_of_birth: member_data?.date_of_birth || null,
          id_number,
          status: "active",
          account_balance: 0
        });
        if (memberError) throw memberError;
      } else {
        // ✅ Update member record if exists (edit)
        await supabase.from("members").update({
          full_name,
          email,
          phone,
          address: member_data?.address || null,
          date_of_birth: member_data?.date_of_birth || null,
          id_number
        }).eq("profile_id", currentUserId);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: currentUserId,
      email,
      id_number
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in admin-register:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
