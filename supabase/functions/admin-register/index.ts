import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      email,
      password,
      full_name,
      phone,
      role,
      id_number,
      address,
      date_of_birth,
      user_id,
    } = await req.json();

    let currentUserId = user_id;

    // ✅ Step 1: Create user if not exists
    if (!currentUserId) {
      const { data: existingUserData, error: existingUserError } =
        await supabase.auth.admin.listUsers();
      if (existingUserError) throw existingUserError;

      const existingUser = existingUserData.users.find((u) => u.email === email);

      if (existingUser) {
        currentUserId = existingUser.id;
      } else {
        const { data: authData, error: authError } =
          await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });
        if (authError) throw authError;
        currentUserId = authData.user.id;
      }
    }

    // ✅ Step 2: Check or create profile
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
        address, // <- top-level
        date_of_birth, // <- top-level
      });
      if (profileError) throw profileError;
    } else {
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({
          full_name,
          phone,
          id_number,
          address, // <- top-level
          date_of_birth, // <- top-level
        })
        .eq("id", currentUserId);
      if (updateProfileError) throw updateProfileError;
    }

    // ✅ Step 3: Create or update member record
    if (role === "member") {
      const { data: existingMember } = await supabase
        .from("members")
        .select("id")
        .eq("profile_id", currentUserId)
        .maybeSingle();

      if (!existingMember) {
        const { data: memberNumberData } = await supabase.rpc(
          "generate_member_number"
        );

        const { error: memberError } = await supabase.from("members").insert({
          profile_id: currentUserId,
          member_number: memberNumberData,
          full_name,
          email,
          phone,
          address, // <- top-level
          date_of_birth, // <- top-level
          id_number,
          status: "active",
          account_balance: 0,
        });
        if (memberError) throw memberError;
      } else {
        const { error: updateMemberError } = await supabase
          .from("members")
          .update({
            full_name,
            email,
            phone,
            address, // <- top-level
            date_of_birth, // <- top-level
            id_number,
          })
          .eq("profile_id", currentUserId);
        if (updateMemberError) throw updateMemberError;
      }
    }

    // ✅ Success Response
    return new Response(
      JSON.stringify({
        success: true,
        user_id: currentUserId,
        email,
        id_number,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in admin-register:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
