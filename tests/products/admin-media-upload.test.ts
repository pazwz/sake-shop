import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { uploadAdminImage } from '@/lib/admin-media-upload';
import { adminMediaPresignValidator } from '@/validators/admin-media.validator';

const upload = {
  uploadUrl: 'https://storage.example.test/upload?signature=test-only',
  key: 'uploads/test.png',
  url: 'https://cdn.example.test/uploads/test.png',
};

const browserTimers = (context: TestContext) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { setTimeout, clearTimeout },
  });
  context.after(() => {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  });
};

for (const type of ['image/png', 'image/jpeg']) {
  for (const size of [1_558_502, 10 * 1024 * 1024]) {
    test(`${type} ${size} bytes is accepted and PUT preserves MIME and body`, async (context) => {
      browserTimers(context);
      const file = new File([new Uint8Array(size)], 'test-image', { type });
      assert.equal(
        adminMediaPresignValidator.safeParse({
          fileName: file.name,
          contentType: type,
          fileSize: size,
        }).success,
        true,
      );
      let requests = 0;
      context.mock.method(
        globalThis,
        'fetch',
        async (url: string, init: RequestInit) => {
          requests += 1;
          if (requests === 1) {
            assert.equal(url, '/api/v1/admin/media/presign');
            assert.equal(init.method, 'POST');
            assert.deepEqual(JSON.parse(String(init.body)), {
              fileName: 'test-image',
              contentType: type,
              fileSize: size,
            });
            return Response.json(
              { success: true, data: upload, message: '', error: null },
              { status: 201 },
            );
          }
          assert.equal(url, upload.uploadUrl);
          assert.equal(init.method, 'PUT');
          assert.deepEqual(init.headers, {
            'Content-Type': type,
            'Cache-Control': 'public, max-age=31536000, immutable',
          });
          assert.equal(init.body, file);
          return new Response(null, { status: 200 });
        },
      );
      assert.deepEqual(await uploadAdminImage(file), {
        url: upload.url,
        key: upload.key,
      });
      assert.equal(requests, 2);
    });
  }
}

test('over 10MB is rejected by the presign validator', () => {
  assert.equal(
    adminMediaPresignValidator.safeParse({
      fileName: 'test.png',
      contentType: 'image/png',
      fileSize: 10 * 1024 * 1024 + 1,
    }).success,
    false,
  );
});

test('presign failure stops before PUT and does not expose backend details', async (context) => {
  browserTimers(context);
  let requests = 0;
  context.mock.method(globalThis, 'fetch', async () => {
    requests += 1;
    return Response.json(
      {
        success: false,
        data: null,
        message: '',
        error: { code: 'MEDIA_PRESIGN_FAILED', detail: 'private credentials' },
      },
      { status: 500 },
    );
  });
  await assert.rejects(
    () =>
      uploadAdminImage(new File(['png'], 'test.png', { type: 'image/png' })),
    {
      message:
        '画像のアップロードを準備できませんでした。しばらくしてからもう一度お試しください。',
    },
  );
  assert.equal(requests, 1);
});

for (const failure of ['network', 'http']) {
  test(`${failure} PUT failure is distinguished from preparation and save failures`, async (context) => {
    browserTimers(context);
    let requests = 0;
    context.mock.method(globalThis, 'fetch', async () => {
      requests += 1;
      if (requests === 1)
        return Response.json(
          { success: true, data: upload, message: '', error: null },
          { status: 201 },
        );
      if (failure === 'network') throw new Error('private signed URL');
      return new Response('private storage details', { status: 403 });
    });
    await assert.rejects(
      () =>
        uploadAdminImage(new File(['png'], 'test.png', { type: 'image/png' })),
      {
        message:
          '画像のアップロードに失敗しました。通信環境を確認して、もう一度お試しください。',
      },
    );
    assert.equal(requests, 2);
  });
}

for (const status of [401, 403]) {
  test(`presign ${status} gives a safe authentication hint without issuing PUT`, async (context) => {
    browserTimers(context);
    let requests = 0;
    context.mock.method(globalThis, 'fetch', async () => {
      requests += 1;
      return new Response('private session details', { status });
    });
    await assert.rejects(
      () =>
        uploadAdminImage(new File(['png'], 'test.png', { type: 'image/png' })),
      { message: 'ログイン状態と画像のアップロード権限を確認してください。' },
    );
    assert.equal(requests, 1);
  });
}
