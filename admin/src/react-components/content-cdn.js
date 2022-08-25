import React, { Component } from "react";
import { withStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Checkbox from "@material-ui/core/Checkbox";
import CircularProgress from "@material-ui/core/CircularProgress";
import LinearProgress from "@material-ui/core/LinearProgress";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import { Title } from "react-admin";
import Button from "@material-ui/core/Button";
import withCommonStyles from "../utils/with-common-styles";
import { getAdminInfo, getEditableConfig, getConfig, putConfig } from "../utils/ita";
import Snackbar from "@material-ui/core/Snackbar";
import SnackbarContent from "@material-ui/core/SnackbarContent";
import Icon from "@material-ui/core/Icon";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import clsx from "classnames";
import configs from "../utils/configs";

// NOTE there's a mysterious uncaught exception in a promise when this component is shown, that seems
// to be coupled with the "All 3rd party content" typography block. It's a mystery.

const styles = withCommonStyles(() => ({
  worker: {
    width: "600px",
    height: "200px",
    fontFamily: "monospace",
    marginTop: "8px"
  },

  workerInput: {
    padding: "8px",
    width: "250px",
    borderRadius: "8px",
    border: "1px solid #ccc",
    margin: "8px"
  }
}));

const workerScript = (workerDomain, workerInstanceName, assetsDomain) => {
  return `  const ALLOWED_ORIGINS = ["${document.location.origin}"];
  const CORS_PROXY_HOST = "https://${workerInstanceName}-cors-proxy.${workerDomain}";
  const PROXY_HOST = "https://${workerInstanceName}-proxy.${workerDomain}";
  const HUB_HOST = "${document.location.origin}";
  const ASSETS_HOST = "https://${assetsDomain}";

  addEventListener("fetch", e => {
    const request = e.request;
    const origin = request.headers.get("Origin");
    // eslint-disable-next-line no-useless-escape

    const isCorsProxy = request.url.indexOf(CORS_PROXY_HOST) === 0;
    const proxyUrl = new URL(isCorsProxy ? CORS_PROXY_HOST : PROXY_HOST);
    const targetPath = request.url.substring((isCorsProxy ? CORS_PROXY_HOST : PROXY_HOST).length + 1);
    let targetUrl;

    if (targetPath.startsWith("files/") || targetPath.startsWith("thumbnail/")) {
      targetUrl = \`\${HUB_HOST}/\${targetPath}\`;
    } else if (targetPath.startsWith("hubs/") || targetPath.startsWith("spoke/") || targetPath.startsWith("admin/") || targetPath.startsWith("assets/")) {
      targetUrl = \`\${ASSETS_HOST}/\${targetPath}\`;
    } else {
      if (!isCorsProxy) {
        // Do not allow cors proxying from main domain, always require cors-proxy. subdomain to ensure CSP stays sane.
        return;
      }
      // This is a weird workaround that seems to stem from the cloudflare worker receiving the wrong url
      targetUrl = targetPath.replace(/^http(s?):\\/([^/])/, "http$1://$2");

      if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
        targetUrl = proxyUrl.protocol + "//" + targetUrl;
      }
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete("Origin"); // Some domains disallow access from improper Origins

    e.respondWith((async () => {
      const res = await fetch(targetUrl, { headers: requestHeaders, method: request.method, redirect: "manual", referrer: request.referrer, referrerPolicy: request.referrerPolicy });
      const responseHeaders = new Headers(res.headers);
      const redirectLocation = responseHeaders.get("Location") || responseHeaders.get("location");

      if(redirectLocation) {
        if (!redirectLocation.startsWith("/")) {
          responseHeaders.set("Location",  proxyUrl.protocol + "//" + proxyUrl.host + "/" + redirectLocation);
        } else {
          const tUrl = new URL(targetUrl);
          responseHeaders.set("Location",  proxyUrl.protocol + "//" + proxyUrl.host + "/" + tUrl.origin + redirectLocation);
        }
      }

      if (origin && ALLOWED_ORIGINS.indexOf(origin) >= 0) {
        responseHeaders.set("Access-Control-Allow-Origin", origin);
        responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        responseHeaders.set("Access-Control-Allow-Headers", "Range");
        responseHeaders.set("Access-Control-Expose-Headers", "Accept-Ranges, Content-Encoding, Content-Length, Content-Range, Hub-Name, Hub-Entity-Type");
      }

      responseHeaders.set("Vary", "Origin");
      responseHeaders.set('X-Content-Type-Options', "nosniff");

      return new Response(res.body, { status: res.status, statusText: res.statusText, headers: responseHeaders });
    })());
  });`;
};

class ContentCDNComponent extends Component {
  state = {
    workerDomain: "",
    workerInstanceName: "",
    assetsDomain: "",
    enableWorker: false,
    saving: false,
    saveError: false,
    loading: false
  };

  async componentDidMount() {
    const adminInfo = await getAdminInfo();
    const retConfig = await getEditableConfig("reticulum");
    let workerDomain = "";

    if (!!retConfig && !!retConfig.phx && retConfig.phx.cors_proxy_url_host.includes("workers.dev")) {
      const corsProxyUrlParts = retConfig.phx.cors_proxy_url_host.split(".");
      workerDomain = corsProxyUrlParts[corsProxyUrlParts.length - 3] + ".workers.dev";
    }

    const workerInstanceName =
      "hubs-" +
      adminInfo.server_domain
        .split(".")
        .join("-")
        .toLowerCase()
        .substring(0, 63 - "hubs-".length - "-cors-proxy".length);

    this.setState({
      assetsDomain: adminInfo.assets_domain,
      provider: adminInfo.provider,
      workerInstanceName,
      workerDomain,
      enableWorker: !!workerDomain,
      loading: false
    });
  }

  async onSubmit(e) {
    e.preventDefault();

    // Sanity check
    if (this.state.enableWorker) {
      const abort = () => {
        this.setState({
          saveError: "Your worker isn't working. Check that you've performed all of the above steps."
        });
      };

      try {
        // Need to CORS-proxy the CORS-proxy because CSP will block us otherwise!
        const res = await fetch(
          `https://${configs.CORS_PROXY_SERVER}/https://${this.state.workerInstanceName}-proxy.${this.state.workerDomain}/hubs/pages/latest/whats-new.html`
        );

        if (!res.ok) {
          abort();
          return;
        }
      } catch (e) {
        abort();
        return;
      }
    }

    this.setState({ saving: true }, async () => {
      const workerDomain = this.state.enableWorker ? this.state.workerDomain : "";
      const workerInstanceName = this.state.enableWorker ? this.state.workerInstanceName : "";
      const corsProxyDomain = `${workerInstanceName}-cors-proxy.${workerDomain}`;
      const proxyDomain = `${workerInstanceName}-proxy.${workerDomain}`;

      const hubsConfig = await getConfig("hubs");
      const spokeConfig = await getConfig("spoke");

      let hubsNonCorsProxyDomains = hubsConfig.general.non_cors_proxy_domains;
      let spokeNonCorsProxyDomains = spokeConfig.general.non_cors_proxy_domains;

      if (this.state.enableWorker) {
        if (!hubsNonCorsProxyDomains.includes(proxyDomain)) {
          hubsNonCorsProxyDomains = [...hubsNonCorsProxyDomains.split(",").filter(x => x.length), proxyDomain].join(
            ","
          );
        }
        if (!spokeNonCorsProxyDomains.includes(proxyDomain)) {
          spokeNonCorsProxyDomains = [...spokeNonCorsProxyDomains.split(",").filter(x => x.length), proxyDomain].join(
            ","
          );
        }
      }

      // For arbortect, we enable thumbnail CDN proxying
      const useWorkerForThumbnails = this.state.provider === "arbortect";

      const configs = {
        reticulum: {
          phx: {
            cors_proxy_url_host: workerDomain ? corsProxyDomain : ""
          },
          uploads: {
            host: workerDomain ? `https://${proxyDomain}` : ""
          }
        },
        hubs: {
          general: {
            cors_proxy_server: workerDomain ? corsProxyDomain : "",
            base_assets_path: workerDomain ? `https://${proxyDomain}/hubs/` : "",
            non_cors_proxy_domains: workerDomain ? hubsNonCorsProxyDomains : "",
            thumbnail_server: workerDomain && useWorkerForThumbnails ? proxyDomain : ""
          }
        },
        spoke: {
          general: {
            cors_proxy_server: workerDomain ? corsProxyDomain : "",
            base_assets_path: workerDomain ? `https://${proxyDomain}/spoke/` : "",
            non_cors_proxy_domains: workerDomain ? spokeNonCorsProxyDomains : "",
            thumbnail_server: workerDomain && useWorkerForThumbnails ? proxyDomain : ""
          }
        }
      };

      try {
        for (const [service, config] of Object.entries(configs)) {
          const res = await putConfig(service, config);

          if (res.error) {
            this.setState({ saveError: `Error saving: ${res.error}` });
            break;
          }
        }
      } catch (e) {
        this.setState({ saveError: e.toString() });
      }

      this.setState({ saving: false, saved: true, saveError: null });
    });
  }

  render() {
    if (this.state.loading) {
      return <LinearProgress />;
    }

    const hasValidWorkerDomain = (this.state.workerDomain || "").endsWith("workers.dev");

    return (
      <Card className={this.props.classes.container}>
        <Title title="Content CDN" />
        <form onSubmit={this.onSubmit.bind(this)}>
          <CardContent className={this.props.classes.info}>
            {this.state.provider === "arbortect" && (
              <Typography variant="body2" gutterBottom>
                通过将 Cloudflare 设置为 CDN，您可以大大减少服务器上的负载并缩短加载时间。
                <br />
                启用后，Cloudflare 将缓存内容、减少延迟并减少服务器使用的带宽。
              </Typography>
            )}
            {this.state.provider && this.state.provider !== "arbortect" && (
              <Typography variant="body2" gutterBottom>
                Hubs Cloud 使用您的云提供商提供的带宽来交付内容。
                <br />
                您可以通过将 CDN 切换到 Cloudflare 来降低数据传输成本，Cloudflare 不会向您的用户收取数据传输成本。
              </Typography>
            )}
            <Typography variant="subheading" gutterBottom className={this.props.classes.section}>
              Worker设置
            </Typography>
            <Typography variant="body1" gutterBottom>
              由于浏览器
              <a href="https://www.codecademy.com/articles/what-is-cors" rel="noopener noreferrer" target="_blank">
                安全模式
              </a>
              ，Hubs Cloud 中的所有第 3 方内容（视频、图像、模型）都需要 CORS 代理 .
              因此，您将使用数据传输将所有第3方内容发送给您的用户。
            </Typography>
            {this.state.provider && this.state.provider !== "arbortect" && (
              <Typography variant="body1" gutterBottom>
                此外，您将产生用于服务化身、场景和其他资产的数据传输成本。
              </Typography>
            )}
            {this.state.provider && this.state.provider !== "arbortect" && (
              <Typography variant="body1" gutterBottom>
                您可以通过使用 Cloudflare Worker 来提供此内容，从而最大限度地降低此数据传输成本：
              </Typography>
            )}
            <Typography variant="body1" component="div" gutterBottom>
              <ol className={this.props.classes.steps}>
                <li>
                  注册&nbsp;
                  <a href="https://cloudflare.com" target="_blank" rel="noopener noreferrer">
                    Cloudflare
                  </a>
                  。
                </li>
                <li>
                  注册后，单击 Cloudflare 徽标以转到您的 <b>Home</b> 选项卡。 (
                  <b>警告 - 不是 &quot;添加网站&quot; 到 Cloudflare</b>, 您仅需要创建workers)
                </li>
                <li>
                  In <b>Home</b> tab, click on <b>Workers</b> panel. You&apos;ll be asked to create a workers subdomain.
                </li>
                <li>
                  在此处输入您的Workers子域名：
                  <p />
                  <input
                    type="text"
                    placeholder="eg. mysite.workers.dev"
                    className={this.props.classes.workerInput}
                    value={this.state.workerDomain}
                    onChange={e => this.setState({ workerDomain: e.target.value })}
                  />
                </li>
                {hasValidWorkerDomain && (
                  <>
                    <li>
                      在Workers仪表板中点击 <b>Create Worker</b>.
                    </li>
                    <li>
                      输入 Worker 名称，例如：
                      <div className={this.props.classes.command}>{this.state.workerInstanceName}-proxy</div>
                    </li>
                    <li>
                      为Worker粘贴、保存和部署以下工作人员脚本。
                      <br />
                      <textarea
                        className={this.props.classes.worker}
                        value={workerScript(
                          this.state.workerDomain,
                          this.state.workerInstanceName,
                          this.state.assetsDomain
                        )}
                        readOnly
                        onFocus={e => e.target.select()}
                      />
                      <br />
                    </li>
                    <li>
                      重复上述步骤并使用相同的脚本创建和部署一个新的Worker。 名称：
                      <div className={this.props.classes.command}>{this.state.workerInstanceName}-cors-proxy</div>
                    </li>
                    <li>
                      不要忘记保存和<b>发布<b/>这两个脚本。
                    </li>
                    <li>
                      验证Workers是否正常工作。
                      <a
                        href={`https://${this.state.workerInstanceName}-cors-proxy.${this.state.workerDomain}/https://www.mozilla.org`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        这个链接
                      </a>
                      应该显示 Mozilla 主页, 而
                      <a
                        href={`https://${this.state.workerInstanceName}-proxy.${this.state.workerDomain}/hubs/pages/latest/whats-new.html`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        这个链接
                      </a>
                      应该显示<b>新鲜事</b>页面。
                    </li>
                    <li>
                      一旦上述<b>两个</b>链接都正常工作，请启用“使用 Cloudflare Worker” 并点击“保存”。
                    </li>
                    <li>
                      如果您每天需要超过 100,000 次内容请求，则需要以额外 5 美元/月的价格添加 Worker Unlimited
                      Subscription。
                    </li>
                  </>
                )}
              </ol>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={this.state.enableWorker}
                    onChange={e => this.setState({ enableWorker: e.target.checked })}
                    value="enableWorker"
                  />
                }
                label="使用 Cloudflare Worker"
              />
            </Typography>
            {this.state.saving ? (
              <CircularProgress />
            ) : (
              (!this.state.enableWorker || hasValidWorkerDomain) && (
                <Button
                  onClick={this.onSubmit.bind(this)}
                  className={this.props.classes.button}
                  variant="contained"
                  color="primary"
                >
                  保存
                </Button>
              )
            )}
          </CardContent>
        </form>
        <Snackbar
          anchorOrigin={{ horizontal: "center", vertical: "bottom" }}
          open={this.state.saved || !!this.state.saveError}
          autoHideDuration={10000}
          onClose={() => this.setState({ saved: false, saveError: null })}
        >
          <SnackbarContent
            className={clsx({
              [this.props.classes.success]: !this.state.saveError,
              [this.props.classes.warning]: !!this.state.saveError
            })}
            message={
              <span id="import-snackbar" className={this.props.classes.message}>
                <Icon className={clsx(this.props.classes.icon, this.props.classes.iconVariant)} />
                {this.state.saveError || "Settings saved."}
              </span>
            }
            action={[
              <IconButton key="close" color="inherit" onClick={() => this.setState({ saved: false })}>
                <CloseIcon className={this.props.classes.icon} />
              </IconButton>
            ]}
          />
        </Snackbar>
      </Card>
    );
  }
}

export const ContentCDN = withStyles(styles)(ContentCDNComponent);
