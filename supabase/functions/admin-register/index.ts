// supabase/functions/admin-register/index.ts
// @ts-ignore: Allow jsr import in Deno edge runtime (no local types)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// @ts-ignore: Allow jsr import in Deno edge runtime (no local types)
import { createClient } from "jsr:@supabase/functions-js"; // ✅ Correct import for Edge Functions

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

export interface AdminRegisterPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  role: "member" | "admin";
  id_number: string;
  address?: string;
  date_of_birth?: string;
  user_id?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: AdminRegisterPayload = await req.json();

    let currentUserId = payload.user_id;

    // Step 1: Check or create auth user
    if (!currentUserId) {
      const { data: existingUserData, error: existingUserError } =
        await supabase.auth.admin.listUsers();
      if (existingUserError) throw existingUserError;

      const existingUser = existingUserData.users.find(u => u.email === payload.email);

      if (existingUser) {
        currentUserId = existingUser.id;
      } else {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: payload.email,
          password: payload.password,
          email_confirm: true,
        });
        if (authError) throw authError;
        currentUserId = authData.user.id;
      }
    }

    // Step 2: Create or update profile
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", currentUserId)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await supabase.from("profiles").insert({
        id: currentUserId,
        email: payload.email,
        full_name: payload.full_name,
        phone: payload.phone,
        role: payload.role,
        id_number: payload.id_number,
        address: payload.address,
        date_of_birth: payload.date_of_birth,
      });
      if (profileError) throw profileError;
    } else {
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({
          full_name: payload.full_name,
          phone: payload.phone,
          id_number: payload.id_number,
          address: payload.address,
          date_of_birth: payload.date_of_birth,
        })
        .eq("id", currentUserId);
      if (updateProfileError) throw updateProfileError;
    }

    // Step 3: Create or update member record (only if role is member)
    if (payload.role === "member") {
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
          full_name: payload.full_name,
          email: payload.email,
          phone: payload.phone,
          address: payload.address,
          date_of_birth: payload.date_of_birth,
          id_number: payload.id_number,
          status: "active",
          account_balance: 0,
        });
        if (memberError) throw memberError;
      } else {
        // Update existing member
        const { error: updateMemberError } = await supabase
          .from("members")
          .update({
            full_name: payload.full_name,
            email: payload.email,
            phone: payload.phone,
            address: payload.address,
            date_of_birth: payload.date_of_birth,
            id_number: payload.id_number,
          })
          .eq("profile_id", currentUserId);
        if (updateMemberError) throw updateMemberError;
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: currentUserId, email: payload.email, id_number: payload.id_number }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in admin-register:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
