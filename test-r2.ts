// Quick test: verify R2 connection by listing bucket contents
import { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const client = new S3Client({
  region: 'auto',
  endpoint: 'https://a2693e1013ea854c3fe46d538fd27ac9.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: '5a509e4a6726f692613a12fe4fec3a3c',
    secretAccessKey: 'b8beff37b3c9a21a4683ba3878cbceb7799c691161901af2b9213de6988cf49c',
  },
});

async function test() {
  console.log('Testing R2 connection...');
  
  // 1. List bucket (should be empty)
  const list = await client.send(new ListObjectsV2Command({ Bucket: 'vaultline' }));
  console.log('✅ Connection works! Bucket contents:', list.Contents?.length ?? 0, 'objects');
  
  // 2. Write a test file
  const testData = Buffer.from('Hello from Vaultline! 🚀');
  await client.send(new PutObjectCommand({
    Bucket: 'vaultline',
    Key: '_test/hello.txt',
    Body: testData,
    ContentType: 'text/plain',
  }));
  console.log('✅ Write works! Uploaded _test/hello.txt');
  
  // 3. Read it back
  const get = await client.send(new GetObjectCommand({
    Bucket: 'vaultline',
    Key: '_test/hello.txt',
  }));
  const body = await get.Body?.transformToByteArray();
  const text = Buffer.from(body!).toString('utf-8');
  console.log('✅ Read works! Got:', text);
  
  // 4. Delete it
  await client.send(new DeleteObjectCommand({
    Bucket: 'vaultline',
    Key: '_test/hello.txt',
  }));
  console.log('✅ Delete works! Cleaned up test file');
  
  console.log('\n🟢 All R2 operations successful. Vaultline is ready to go!');
}

test().catch(err => {
  console.error('❌ R2 test failed:', err.message);
  process.exit(1);
});