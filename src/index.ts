/* eslint-disable no-restricted-syntax */

export enum RESP_TYPE {
  JSON = 'json',
  TEXT = 'text',
  FORMDATA = 'formData',
  BLOB = 'blob',
  ARRAYBUFFER = 'arrayBuffer',
}

export type RequestMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'delete'
  | 'options'
  | 'head';
export interface RequestHeader {
  [key: string]: any;
}
export interface RequestMeta {
  [key: string]: any;
}

export interface FetchOpts {
  method?: RequestMethod;
  headers?: RequestHeader;
  body?: any;
  signal?: AbortSignal | undefined;
  meta?: RequestMeta;
}

export interface FetchConfig {
  timeout?: number;
  defaultRespType?: RESP_TYPE;
  validateStatus?: (status: number) => boolean;
}

export interface ResponseInterceptorBody {
  headers: Headers;
  data: any;
  config: FetchOpts;
  url: string;
}

export type RequestInterceptorFn = (opts: FetchOpts, url: string) => FetchOpts;
export type ResponseInterceptorFn = (resp: ResponseInterceptorBody) => any;
export type ErrorInterceptorFn = (
  err: Error,
  opts: FetchOpts,
  url: string
) => any;
export type FinallyInterceptorFn = (opts: FetchOpts, url: string) => any;

export interface Interceptors {
  request: Array<RequestInterceptorFn>;
  response: Array<ResponseInterceptorFn>;
  errorHandler: Array<ErrorInterceptorFn>;
  finally: Array<FinallyInterceptorFn>;
}

interface Reject_Response {
  status: number;
  statusText: string;
}

interface Fetch {
  constructor(defaultOpts: FetchOpts, config?: FetchConfig): Fetch;
  defaultOpts: FetchOpts;
  interceptors: Interceptors;
  defaultRespType: RESP_TYPE;
  timeout: number;
  validateStatus: (status: number) => boolean;
}

/**
 * Detect weather
 */
let canAbortFetch = false;
// Window cannot be used in web worker
try {
  canAbortFetch = 'AbortController' in window;
} catch (_) {
  canAbortFetch = false;
}

/**
 * Default response type for module
 */
const DEFAULT_RESP_TYPE = RESP_TYPE.JSON;
const DEFAULT_TIMEOUT_CODE = -1;

/**
 * Default timeout time
 */
const DEFAULT_TIMEOUT = 30000; // 30s

const globalDefaultOptions = {} as FetchOpts;

const defaultValidateStatus = (status: number) => status >= 200 && status < 300;

const createProxy = (promise: any, cancelFn: () => void) =>
  new Proxy(promise, {
    get(target, key) {
      switch (key) {
        case 'then':
        case 'catch':
        case 'finally':
          const newPromiseFn = Reflect.get(target, key).bind(target);
          const wrapFn = (cb: any) => {
            const newPromise = newPromiseFn(cb);
            return createProxy(newPromise, cancelFn);
          };
          return wrapFn;
        case 'cancel':
          return cancelFn.bind(target);
        default:
          return Reflect.get(target, key);
      }
    },
  });

/**
 * Fetch class used to create new fetch instance
 *
 * @author lucky.zhou
 * @class
 */
class Fetch {
  constructor(defaultConfig: FetchOpts, settings: FetchConfig) {
    this.defaultOpts = {
      ...globalDefaultOptions,
      ...defaultConfig,
    };
    this.timeout = settings.timeout || DEFAULT_TIMEOUT;
    this.validateStatus = settings.validateStatus || defaultValidateStatus;
    this.defaultRespType = settings.defaultRespType || DEFAULT_RESP_TYPE;
    this.interceptors = {
      response: [],
      request: [],
      errorHandler: [],
      finally: [],
    };
  }

  get(url: string, opts: FetchOpts, respType: RESP_TYPE) {
    let nUrl = url;
    if (opts.body) {
      const params = opts.body;
      const keys = Object.keys(params);
      keys.forEach((key) => {
        const param = `${key}=${params[key]}`;
        nUrl = nUrl.indexOf('?') > -1 ? `${nUrl}&${param}` : `${nUrl}?${param}`;
      });
      delete opts.body;
    }
    return this.fetch(nUrl, { ...opts, method: 'get' }, respType);
  }

  post(url: string, opts: FetchOpts, respType: RESP_TYPE) {
    return this.fetch(url, { ...opts, method: 'post' }, respType);
  }

  delete(url: string, opts: FetchOpts, respType: RESP_TYPE) {
    return this.fetch(url, { ...opts, method: 'delete' }, respType);
  }

  put(url: string, opts: FetchOpts, respType: RESP_TYPE) {
    return this.fetch(url, { ...opts, method: 'put' }, respType);
  }

  /**
   * Base function for using default fetch
   *
   * @param {string} url The request url
   * @param {object} options The request options
   *
   * @description
   * `options` follow the w3c fetch options structure
   * `meta` in `options` used to pass meta info.
   *
   * @returns {Promise} The request promise
   */
  fetch(url: string, options: FetchOpts, respType: RESP_TYPE) {
    // const respContentType = respType || this.defaultRespType;
    const opts = {
      url,
      ...this.defaultOpts,
      ...options,
      headers: {
        ...this.defaultOpts.headers,
        ...options.headers,
      },
    };

    // to use chained options in interceptors array
    const hackedOpts = this.interceptors.request.reduce(
      (prev: FetchOpts, cur: RequestInterceptorFn) => cur(prev, url),
      opts
    );

    let timeoutTimer: NodeJS.Timeout;
    const fetchController = canAbortFetch
      ? new AbortController()
      : ({} as AbortController);

    hackedOpts.signal = fetchController.signal;

    let timeoutReject = null as any;
    const cancelRequest = () => {
      if (timeoutReject) {
        // Must reject first here!
        // eslint-disable-next-line
        timeoutReject({
          status: DEFAULT_TIMEOUT_CODE,
          statusText: 'Timeout',
        } as Reject_Response);
        if (canAbortFetch) fetchController.abort();
      }
    };

    /**
     * timeout promise to abort request if necessary
     */
    const abortPromise = new Promise((resolve, reject) => {
      timeoutReject = reject;
      timeoutTimer = setTimeout(cancelRequest, this.timeout);
    });
    /**
     * real fetch request promise
     */
    const fetchPromise = fetch(url, hackedOpts);

    const resultPromise = Promise.race([fetchPromise, abortPromise])
      // 1. clear timeout timer
      .then((resp) => {
        clearTimeout(timeoutTimer);
        return resp;
      })
      // 2. transform response data type and return
      .then((resp: any) => {
        if (!this.validateStatus(resp.status)) {
          return Promise.reject({
            status: resp.status,
            statusText: resp.statusText,
          });
        }
        return resp[respType]().then((data: any) => ({
          data,
          headers: resp.headers,
        }));
      })
      // 3. handle response interceptors transform and return new data
      .then(({ headers, data }) =>
        this.interceptors.response.reduce(
          (prev, cur) => prev.then(cur),
          Promise.resolve({
            headers,
            data,
            config: hackedOpts,
            url,
          })
        )
      )
      .catch((err) => {
        clearTimeout(timeoutTimer);
        this.interceptors.errorHandler.forEach((fn) =>
          fn(err, hackedOpts, url)
        );
        // throw err;
        return Promise.reject(err);
      })
      .finally(() => {
        this.interceptors.finally.forEach((fn) => fn(hackedOpts, url));
      });

    // return resultPromise;
    return createProxy(resultPromise, cancelRequest);
  }
}

/**
 * Fetch instance factory function
 *
 * @param {object} cfg The request options for every request
 * @param {object} settings The fetch settings for controller
 */
const createFetchInstance = (opts = {}, settings = {}) => {
  /* istanbul ignore next */
  if (typeof window === 'undefined' || !('fetch' in window)) {
    // eslint-disable-next-line
    console.error("fetch function doesn't detected in you environment");
    return null;
  }

  const instance = new Fetch(opts, settings);
  const rawFetch = instance.fetch.bind(instance) as any;

  rawFetch.get = instance.get.bind(instance);
  rawFetch.post = instance.post.bind(instance);
  rawFetch.put = instance.put.bind(instance);
  rawFetch.delete = instance.delete.bind(instance);
  rawFetch.interceptors = instance.interceptors;

  return rawFetch;
};

export default createFetchInstance;
