import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'profiles' });

    if (error) {
        // If RPC doesn't exist, try a simple query
        const { data: profile, error: queryError } = await supabase
            .from('profiles')
            .select('*')
            .limit(1);

        if (queryError) {
            console.error('Error fetching profiles:', queryError);
        } else {
            console.log('Profile columns observed:', Object.keys(profile[0] || {}));
        }
    } else {
        console.log('Columns:', data);
    }
}

checkSchema();
