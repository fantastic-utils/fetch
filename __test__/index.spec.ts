// @ts-nocheck

import 'isomorphic-fetch';
import * as nock from 'nock';
import createFetchInstance from '../src/index';

describe('Methods', () => {
  let http = {} as any;

  beforeAll(() => {
    nock('http://www.example.com').get('/resource').reply(200, 'rt');

    nock('http://www.example.com').get('/resource2').reply(200, 'rt');

    nock('http://www.example.com').post('/resource').reply(200, 'added');

    nock('http://www.example.com').put('/resource').reply(200, 'saved');

    nock('http://www.example.com').delete('/resource').reply(200, 'deleted');

    http = createFetchInstance();
  });

  test('raw fetch', async () => {
    const { data } = await http(
      'http://www.example.com/resource',
      { method: 'get' },
      'text'
    );
    expect(data).toBe('rt');
  });

  test('get', async () => {
    const { data } = await http.get(
      'http://www.example.com/resource2',
      {},
      'text'
    );
    expect(data).toBe('rt');
  });
  test('post', async () => {
    const { data } = await http.post(
      'http://www.example.com/resource',
      {},
      'text'
    );
    expect(data).toBe('added');
  });
  test('put', async () => {
    const { data } = await http.put(
      'http://www.example.com/resource',
      {},
      'text'
    );
    expect(data).toBe('saved');
  });
  test('delete', async () => {
    const { data } = await http.delete(
      'http://www.example.com/resource',
      {},
      'text'
    );
    expect(data).toBe('deleted');
  });
});

describe('Interceptors', () => {
  beforeAll(() => {
    nock('http://www.example.com').get('/resource').times(3).reply(200, 'rt');

    nock('http://www.example.com').get('/notExist').reply(404, 'rt');
  });

  test('Request interceptor', async () => {
    const http = createFetchInstance();
    http.interceptors.request.push((opt) => {
      opt.headers['X-Test-Header'] = 'testHeader';
      return opt;
    });

    const {
      data,
      config: { headers },
    } = await http.get('http://www.example.com/resource', {}, 'text');

    expect(data).toBe('rt');
    expect(headers['X-Test-Header']).toBe('testHeader');
  });

  test('Response interceptor', async () => {
    const http = createFetchInstance();
    http.interceptors.response.push((wrappedResp) => {
      return Promise.resolve(wrappedResp.data);
    });

    const data = await http.get('http://www.example.com/resource', {}, 'text');
    expect(data).toBe('rt');
  });

  test('Error handler', async () => {
    const http = createFetchInstance();
    const errorHandler = jest.fn();

    http.interceptors.errorHandler.push(errorHandler);

    await http
      .get('http://www.example.com/notExist', {}, 'text')
      .catch((error) => {
        expect(error.status).toBe(404);
      });

    expect(errorHandler).toHaveBeenCalled();
  });

  test('Finally handler', async () => {
    const http = createFetchInstance();
    const finallyMockFn = jest.fn();
    http.interceptors.finally.push(finallyMockFn);

    await http.get('http://www.example.com/resource', {}, 'text');

    expect(finallyMockFn).toHaveBeenCalled();
  });
});

describe('Cancel & Timeout', () => {
  beforeAll(() => {
    nock('http://www.example.com')
      .persist()
      .get('/resource')
      .delay(500)
      .reply(200, 'rt');
  });

  test('1s timeout', async () => {
    const http = createFetchInstance({}, { timeout: 250 });
    const errorHandler = jest.fn();
    http.interceptors.errorHandler.push(errorHandler);

    await http
      .get('http://www.example.com/resource', {}, 'text')
      .catch((err) => {
        expect(err?.status).toBe(-1);
      });

    expect(errorHandler).toHaveBeenCalled();
  });

  test('Cancel manually', async () => {
    const http = createFetchInstance({}, { timeout: 1000 });
    const errorHandler = jest.fn();
    http.interceptors.errorHandler.push(errorHandler);
    const requestPromise = http
      .get('http://www.example.com/resource', {}, 'text')
      .catch((err) => {
        expect(err?.status).toBe(-1);
      });
    setTimeout(() => {
      requestPromise.cancel();
    }, 250);
    await requestPromise;
    expect(errorHandler).toHaveBeenCalled();
  });

  test('Cancel manually with chained promise', async () => {
    const http = createFetchInstance({}, { timeout: 1000 });
    const errorHandler = jest.fn();
    const thenHandler = jest.fn();
    http.interceptors.errorHandler.push(errorHandler);
    const requestPromise = http.get(
      'http://www.example.com/resource',
      {},
      'text'
    );
    const newPromise = requestPromise
      .then(thenHandler)
      .then(thenHandler)
      .catch((err) => {
        expect(err?.status).toBe(-1);
      });
    setTimeout(() => {
      newPromise.cancel();
    }, 250);
    await newPromise;

    expect(errorHandler).toHaveBeenCalled();
    expect(thenHandler.mock.calls).toHaveLength(0);
  });
});

describe('Response code handle', () => {
  let http = {};

  beforeAll(() => {
    nock('http://www.example.com').get('/ok').reply(200, 'ok');

    nock('http://www.example.com').get('/redirect').reply(301, '', {
      Location: '/ok',
    });

    nock('http://www.example.com').get('/multi-choice').reply(300, '', {
      Location: '/ok',
    });

    nock('http://www.example.com').get('/use-proxy').reply(305, '', {
      Location: '/ok',
    });

    nock('http://www.example.com').get('/not-found').reply(404, 'added');

    http = createFetchInstance();
  });

  test('301|302|307|308 follow redirect', async () => {
    const { data } = await http.get(
      'http://www.example.com/redirect',
      {},
      'text'
    );
    expect(data).toBe('ok');
  });

  // NOTE: this test will failed when support 300 redirect follow
  test('300 multi choice', async () => {
    const errorHandler = jest.fn();
    http.interceptors.errorHandler.push(errorHandler);

    await http
      .get('http://www.example.com/multi-choice', {}, 'text')
      .catch((err) => {
        expect(err?.status).toBe(300);
      });

    expect(errorHandler).toHaveBeenCalled();
  });

  // NOTE: this test will failed when support 305 redirect follow
  test('305 use proxy', async () => {
    const errorHandler = jest.fn();
    http.interceptors.errorHandler.push(errorHandler);

    await http
      .get('http://www.example.com/use-proxy', {}, 'text')
      .catch((err) => {
        expect(err?.status).toBe(305);
      });

    expect(errorHandler).toHaveBeenCalled();
  });

  test('> 400 error', async () => {
    const errorHandler = jest.fn();
    http.interceptors.errorHandler.push(errorHandler);

    await http
      .get('http://www.example.com/not-found', {}, 'text')
      .catch((err) => {
        expect(err?.status).toBe(404);
      });

    expect(errorHandler).toHaveBeenCalled();
  });
});
