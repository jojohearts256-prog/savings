const SUPABASE_URL = 'https://devegvzpallxsmbyszcb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRldmVndnpwYWxseHNtYnlzemNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NTcyODIsImV4cCI6MjA3NTUzMzI4Mn0.mYNvJTT08dFdHJNx7jSywKrkwfjWJN5OcHK5q3dSOb8';

const adminData = {
  email: 'admin@savingsgroup.com',
  password: 'Admin@2025',
  full_name: 'System Administrator',
  phone: '+1234567890',
  role: 'admin',
  id_number: 'ADM001',
};

async function createAdmin() {
  try {
    console.log('Creating admin account...');

    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(adminData),
    });

    const result = await response.json();

    if (result.success) {
      console.log('\n✅ Admin account created successfully!\n');
      console.log('═══════════════════════════════════════');
      console.log('     ADMIN LOGIN CREDENTIALS');
      console.log('═══════════════════════════════════════');
      console.log('Email:    ', adminData.email);
      console.log('Password: ', adminData.password);
      console.log('ID Number:', adminData.id_number);
      console.log('═══════════════════════════════════════\n');
      console.log('⚠️  Please save these credentials securely!');
      console.log('You can now log in to the admin dashboard.\n');
    } else {
      console.error('❌ Error creating admin:', result.error);
      if (result.error.includes('already exists') || result.error.includes('duplicate')) {
        console.log('\n✅ Admin account already exists. Use these credentials:\n');
        console.log('═══════════════════════════════════════');
        console.log('     ADMIN LOGIN CREDENTIALS');
        console.log('═══════════════════════════════════════');
        console.log('Email:    ', adminData.email);
        console.log('Password: ', adminData.password);
        console.log('ID Number:', adminData.id_number);
        console.log('═══════════════════════════════════════\n');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createAdmin();
