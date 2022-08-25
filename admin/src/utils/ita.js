import configs from "./configs";

const schemaCategories = [
  "api_keys",
  "content",
  "email",
  "advanced",
  "translations",
  "features",
  "rooms",
  "images",
  "theme",
  "links",
  "auth"
];
const serviceNames = configs.CONFIGURABLE_SERVICES.split(",");
let currentAuthToken = null;

const setAuthToken = function(token) {
  currentAuthToken = token;
};

function getCategoryDisplayName(category) {
  switch (category) {
    case "api_keys":
      return "密钥设置";
    case "content":
      return "内容设置";
    case "email":
      return "邮件设置";
    case "advanced":
      return "高级设置";
    case "translations":
      return "文案设置";
    case "features":
      return "功能设置";
    case "rooms":
      return "房间设置";
    case "images":
      return "图像设置";
    case "theme":
      return "主题设置";
    case "links":
      return "链接设置";
    case "auth":
      return "身份验证";
    default:
      return null;
  }
}

function getCategoryDescription(category, provider) {
  switch (category) {
    case "api_keys":
      return "用于媒体搜索的第3方服务的API密钥。";
    case "content":
      return "用户贡献的内容设置。";
    case "email":
      if (provider === "arbortect") {
        return "自定义 SMTP 电子邮件提供商设置。留空以使用您在配置服务器时选择的 SMTP 设置。想要自定义登录链接电子邮件？请转到应用设置 > 身份验证";
      } else {
        return "自定义 SMTP 电子邮件提供商设置。留空以使用您的云提供商的电子邮件服务。想要自定义登录链接电子邮件？请转到应用设置 > 身份验证";
      }
    case "advanced":
      return "请勿修改，除非您清楚的知道自己正在修改什么。";
    case "translations":
      return "您可以更改的文本信息。";
    case "features":
      return "您可以切换的功能。";
    case "images":
      return "替换应用程序中的图像。";
    case "colors":
      return "替换应用程序中的颜色。";
    case "links":
      return "替换应用程序中的链接。";
    case "auth":
      return "自定义登录电子邮件选项。";
    default:
      return null;
  }
}

function getServiceDisplayName(service) {
  switch (service) {
    case "janus-gateway":
      return "Janus";
    case "reticulum":
      return "Reticulum";
    case "ita":
      return "Ita";
    default:
      return null;
  }
}

function getEndpoint(path) {
  if (configs.ITA_SERVER) {
    return `${configs.ITA_SERVER}/${path}`;
  } else {
    return `/api/ita/${path}`;
  }
}

function fetchWithAuth(req) {
  const options = {};
  options.headers = new Headers();
  options.headers.set("Authorization", `Bearer ${currentAuthToken}`);
  options.headers.set("Content-Type", "application/json");
  return fetch(req, options);
}

function getSchemas() {
  return fetchWithAuth(getEndpoint("schemas")).then(resp => resp.json());
}

function getAdminInfo() {
  return fetchWithAuth(getEndpoint("admin-info"))
    .then(resp => {
      if (resp.status === 200) return resp.json();
      else return { error: true, code: resp.status };
    })
    .catch(e => console.error(e));
}

function getEditableConfig(service) {
  return fetchWithAuth(getEndpoint(`configs/${service}/ps`)).then(resp => resp.json());
}

function getConfig(service) {
  return fetchWithAuth(getEndpoint(`configs/${service}`)).then(resp => resp.json());
}

function putConfig(service, config) {
  const req = new Request(getEndpoint(`configs/${service}`), {
    method: "PATCH",
    body: JSON.stringify(config)
  });
  return fetchWithAuth(req).then(resp => resp.json());
}

// An object is considered to be a config descriptor if it at least has
// a "type" key and has no keys which aren't valid descriptor metadata.
const DESCRIPTOR_FIELDS = [
  "default",
  "type",
  "of",
  "unmanaged",
  "category",
  "name",
  "description",
  "internal",
  "source",
  "deprecated"
];
function isDescriptor(obj) {
  if (typeof obj !== "object") return false;
  if (!("type" in obj)) return false;
  for (const k in obj) {
    if (!DESCRIPTOR_FIELDS.includes(k)) {
      return false;
    }
  }
  return true;
}

function getConfigValue(config, path) {
  let obj = config;
  for (const p of path) {
    if (p in obj) {
      obj = obj[p]; // go down one level
    } else {
      obj = undefined; // the configuration for this value is empty; we can stop
      break;
    }
  }
  return obj;
}

function setConfigValue(config, path, val) {
  let obj = config;
  for (const p of path.slice(0, -1)) {
    if (p in obj) {
      obj = obj[p]; // go down one level
    } else {
      obj = obj[p] = {}; // the configuration for this value is empty; keep creating new objects going down
    }
  }
  obj[path.slice(-1)] = val;
}

// Returns a map keyed by category that contains all the configs in that category.
const schemaByCategories = schema => {
  const o = {};

  for (const cat of schemaCategories) {
    o[cat] = JSON.parse(JSON.stringify(schema)); // Cheap copy

    // Remove nodes not belonging to category and clear empties
    const walk = n => {
      for (const x in n) {
        const v = n[x];
        if (isDescriptor(v)) {
          if (v.category !== cat) {
            delete n[x];
          }
        } else {
          walk(v);

          if (Object.keys(n[x]).length === 0) {
            delete n[x];
          }
        }
      }
    };

    walk(o[cat]);
  }

  return o;
};

export {
  schemaCategories,
  serviceNames,
  isDescriptor,
  getServiceDisplayName,
  getCategoryDisplayName,
  getCategoryDescription,
  getSchemas,
  getConfig,
  getEditableConfig,
  putConfig,
  getConfigValue,
  setConfigValue,
  setAuthToken,
  schemaByCategories,
  getAdminInfo
};
