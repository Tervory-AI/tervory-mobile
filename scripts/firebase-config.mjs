import { writeFile } from 'node:fs/promises';

const value = process.env.MOBILE_FIREBASE_GOOGLE_SERVICES_JSON;
if (value) {
  const config = JSON.parse(value);
  if (!config.client?.some(client => client.client_info?.android_client_info?.package_name === 'com.tervory.app')) {
    throw new Error('Firebase client configuration must belong to com.tervory.app');
  }
  await writeFile('android/app/google-services.json', JSON.stringify(config), { mode: 0o600 });
} else {
  console.log('Firebase client configuration is not set; build without Android push registration.');
}
