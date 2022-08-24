import React, { Component } from "react";
import { Title } from "react-admin";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemIcon from "@material-ui/core/ListItemIcon";

import LockIcon from "@material-ui/icons/Lock";
import PaletteIcon from "@material-ui/icons/Palette";
import VpnKeyIcon from "@material-ui/icons/VpnKey";
import CodeIcon from "@material-ui/icons/Code";
import DeveloperModeIcon from "@material-ui/icons/DeveloperMode";

import Warning from "@material-ui/icons/Warning";
import Info from "@material-ui/icons/Info";
import { fetchReticulumAuthenticated } from "hubs/src/utils/phoenix-utils";
import withCommonStyles from "../utils/with-common-styles";
import { getAdminInfo, getEditableConfig } from "../utils/ita";
import configs from "../utils/configs";

// Send quota to use as heuristic for checking if in SES sandbox
// https://forums.aws.amazon.com/thread.jspa?threadID=61090
const MAX_AWS_SES_QUOTA_FOR_SANDBOX = 200;

const styles = withCommonStyles(() => ({}));

class SystemEditorComponent extends Component {
  state = {
    reticulumMeta: {}
  };

  async componentDidMount() {
    const adminInfo = await getAdminInfo();
    const retConfig = await getEditableConfig("reticulum");

    this.setState({ adminInfo, retConfig });
    this.updateReticulumMeta();
  }

  async updateReticulumMeta() {
    const reticulumMeta = await fetchReticulumAuthenticated(`/api/v1/meta?include_repo`);
    this.setState({ reticulumMeta });
  }

  render() {
    const needsAvatars = this.state.reticulumMeta.repo && !this.state.reticulumMeta.repo.avatar_listings.any;
    const needsScenes = this.state.reticulumMeta.repo && !this.state.reticulumMeta.repo.scene_listings.any;
    const exceededStorageQuota = this.state.reticulumMeta.repo && !this.state.reticulumMeta.repo.storage.in_quota;

    const isInSESSandbox =
      this.state.adminInfo &&
      this.state.adminInfo.using_ses &&
      this.state.adminInfo.ses_max_24_hour_send <= MAX_AWS_SES_QUOTA_FOR_SANDBOX;

    const isUsingCloudflare =
      this.state.adminInfo &&
      this.state.retConfig &&
      this.state.retConfig.phx &&
      this.state.retConfig.phx.cors_proxy_url_host === `cors-proxy.${this.state.adminInfo.worker_domain}`;

    return (
      <>
        <Card className={this.props.classes.container}>
          <Title title="Hubs Cloud" />
          <CardContent className={this.props.classes.info}>
            <Typography variant="title" gutterBottom>
              🐣 系统已上线
            </Typography>
            <Typography variant="body1" gutterBottom>
              需要帮助吗？ 看看
              <a
                href="https://hubs.mozilla.com/docs/hubs-cloud-getting-started.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                入门指引
              </a>
            </Typography>
            <Typography variant="body1" gutterBottom>
              Hubs Cloud 会自动更新，请查看
              <a
                href="https://github.com/mozilla/hubs-cloud/blob/master/CHANGELOG.md"
                target="_blank"
                rel="noopener noreferrer"
              >
                更新日志
              </a>
            </Typography>
            <Typography variant="body1" gutterBottom>
              <b>有疑问？</b> 请访问
              <a href="https://hubs.mozilla.com/docs/welcome.html" target="_blank" rel="noopener noreferrer">
                文档中心
              </a>{" "}
              或
              <a href="https://github.com/mozilla/hubs/discussions" target="_blank" rel="noopener noreferrer">
                创建讨论
              </a>{" "}
              或
              <a href="https://github.com/mozilla/hubs" target="_blank" rel="noopener noreferrer">
                提交问题
              </a>
            </Typography>
            {this.state.reticulumMeta &&
              this.state.adminInfo &&
              (needsAvatars || needsScenes || isInSESSandbox || exceededStorageQuota) && (
                <List>
                  {isInSESSandbox && (
                    <ListItem>
                      <ListItemIcon className={this.props.classes.warningIcon}>
                        <Warning />
                      </ListItemIcon>
                      <ListItemText
                        inset
                        primary={
                          <span>
                            您的AWS账户
                            <a
                              href="https://docs.aws.amazon.com/ses/latest/DeveloperGuide/request-production-access.html"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              SES邮件服务
                            </a>
                            处于受限沙箱中。 用户将无法收到登录邮件，请参考：
                            <a
                              href="https://hubs.mozilla.com/docs/hubs-cloud-aws-troubleshooting.html#youre-in-the-aws-sandbox-and-people-dont-receive-magic-link-emails"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              解决方案
                            </a>
                            #1, #2, #3, 或
                            <a
                              href="https://hubs.mozilla.com/docs/hubs-cloud-aws-existing-email-provider.html"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              使用现有的电子邮件提供商
                            </a>
                          </span>
                        }
                        secondary={
                          <span>
                            在系统可以发送电子邮件之前，用户将无法登录。您可以
                            <a
                              href="https://docs.aws.amazon.com/ses/latest/DeveloperGuide/request-production-access.html"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              按照说明进行操作
                            </a>
                            请求提升限额，或在<a href="/admin#/server-setup">服务器设置</a>里使用其他的邮件提供商。
                          </span>
                        }
                      />
                    </ListItem>
                  )}
                  {exceededStorageQuota && (
                    <ListItem>
                      <ListItemIcon className={this.props.classes.warningIcon}>
                        <Warning />
                      </ListItemIcon>
                      <ListItemText
                        inset
                        primary={<span>您已超出指定的存储限制。</span>}
                        secondary={
                          <span>请前往AWS堆栈设置中增加“存储限制”，否者访客将无法上传新场景、头像或文件。</span>
                        }
                      />
                    </ListItem>
                  )}
                  {needsAvatars && (
                    <ListItem>
                      <ListItemIcon className={this.props.classes.warningIcon}>
                        <Warning />
                      </ListItemIcon>
                      <ListItemText inset primary="您的系统没有头像。" secondary="选择左侧的“导入内容”以加载头像。" />
                    </ListItem>
                  )}
                  {needsScenes && (
                    <ListItem>
                      <ListItemIcon className={this.props.classes.warningIcon}>
                        <Warning />
                      </ListItemIcon>
                      <ListItemText inset primary="您的系统没有场景。" secondary="选择左侧的“导入内容”以加载场景。" />
                    </ListItem>
                  )}
                  {!isUsingCloudflare && (
                    <ListItem>
                      <ListItemIcon className={this.props.classes.infoIcon}>
                        <Info />
                      </ListItemIcon>
                      <ListItemText
                        inset
                        primary={
                          this.state.adminInfo.provider === "arbortect"
                            ? "您没有使用 CDN。"
                            : "您正在使用您的云提供商来提供内容。"
                        }
                        secondary="您可以通过使用 Cloudflare 的 CDN 来提供内容来降低成本并提高性能。 选择左侧的“CDN设置”以获取更多信息。"
                      />
                    </ListItem>
                  )}
                </List>
              )}
          </CardContent>
        </Card>
        <Card className={this.props.classes.container}>
          <Typography variant="title" gutterBottom>
            在管理面板， 您可以：
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <PaletteIcon />
              </ListItemIcon>
              <ListItemText
                primary={
                  <span>
                    在<i>应用设置</i>菜单中自定义
                    <a
                      href="https://hubs.mozilla.com/docs/hubs-cloud-customizing-look-and-feel.html"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      外观
                    </a>
                  </span>
                }
              />
            </ListItem>
            <ListItem style={{ paddingLeft: "100px", paddingTop: "0px" }}>
              <ListItemText
                primary={
                  <span>
                    更改图像、网站图标等 - <i>图像标签</i>
                  </span>
                }
              />
            </ListItem>
            <ListItem style={{ paddingLeft: "100px", paddingTop: "0px" }}>
              <ListItemText
                primary={
                  <span>
                    设置主题颜色 - <i>主题标签</i>
                  </span>
                }
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <LockIcon />
              </ListItemIcon>
              <ListItemText
                primary={
                  <span>
                    通过
                    <a
                      href="https://hubs.mozilla.com/docs/hubs-cloud-limiting-user-access.html"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      限制访问指南
                    </a>
                    将您的实例锁定给特定用户
                  </span>
                }
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <VpnKeyIcon />
              </ListItemIcon>
              <ListItemText
                primary={
                  <span>
                    管理您的API Keys, 例如: Google Analytics, Sketchfab, Discord. - &nbsp;
                    <i>服务器设置&nbsp;&gt;&nbsp;API设置</i>
                  </span>
                }
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <DeveloperModeIcon />
              </ListItemIcon>

              <ListItemText
                primary={
                  <span>
                    添加额外的 Javascript、CSS、标题、HTML和跨域设置 - &nbsp;
                    <i>服务器设置&nbsp;&gt;&nbsp;高级选项</i>
                  </span>
                }
              />
            </ListItem>
          </List>
        </Card>
        <Card className={this.props.classes.container}>
          <Title title="Hubs Cloud" />
          <CardContent className={this.props.classes.info}>
            <Typography variant="title" gutterBottom>
              当前版本
            </Typography>
            {configs.IS_LOCAL_OR_CUSTOM_CLIENT ? (
              <>
                <Typography variant="body1" gutterBottom>
                  {`应用客户端版本: ${process.env.BUILD_VERSION || "?"}`}
                </Typography>
              </>
            ) : (
              <Typography variant="body1" gutterBottom>
                {`App client: ${process.env.BUILD_VERSION || "?"}`}
              </Typography>
            )}
          </CardContent>
        </Card>
      </>
    );
  }
}

export const SystemEditor = withStyles(styles)(SystemEditorComponent);
