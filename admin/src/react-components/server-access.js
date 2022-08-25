import React, { Component } from "react";
import { withStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import { Title } from "react-admin";
import Button from "@material-ui/core/Button";
import withCommonStyles from "../utils/with-common-styles";
import { getAdminInfo } from "../utils/ita";

const styles = withCommonStyles(() => ({}));

class ServerAccessComponent extends Component {
  state = {
    qrCodeData: null,
    serverDomain: "",
    showQrCode: false
  };

  async componentDidMount() {
    const adminInfo = await getAdminInfo();
    this.setState({
      qrCodeData: adminInfo.ssh_totp_qr_data,
      serverDomain: adminInfo.server_domain,
      provider: adminInfo.provider
    });
  }

  render() {
    return (
      <Card className={this.props.classes.container}>
        <Title title="Server Access" />
        <CardContent className={this.props.classes.info}>
          <Typography variant="body2" gutterBottom>
            Hubs Cloud 使用 SSH 访问和双重身份验证设置您的服务器。
          </Typography>
          <Typography variant="subheading" className={this.props.classes.section} gutterBottom>
            连接到服务器
          </Typography>
          <Typography variant="body1" gutterBottom>
            要通过 SSH 连接到您的服务器，您将使用在部署 Hubs Cloud 之前创建的 SSH 私钥文件。
          </Typography>
          {this.state.provider !== "arbortect" && (
            <Typography variant="body1" gutterBottom>
              您的每台服务器都有一个名称。 该名称可以在您的云提供商控制台的服务器列表中找到。 （例如，在 AWS
              控制台上，转到 EC2 -&gt; Instances）
            </Typography>
          )}
          <Typography variant="body1" gutterBottom component="div">
            要连接到服务器，请运行以下命令：
            {this.state.provider === "arbortect" && (
              <div className={this.props.classes.command}>ssh -i &lt;key file&gt; root@{this.state.serverDomain}</div>
            )}
            {this.state.provider === "aws" && (
              <div className={this.props.classes.command}>
                ssh -i &lt;key file&gt; ubuntu@&lt;server name&gt;.{this.state.serverDomain}
              </div>
            )}
          </Typography>
          {this.state.qrCodeData && (
            <div>
              <Typography variant="subheading" className={this.props.classes.section} gutterBottom>
                双因素验证
              </Typography>
              <Typography variant="body1" gutterBottom>
                连接后，如果您的服务器上已配置 2FA，您将需要一个一次性验证码。
                这是一个双因素安全措施，是一个旋转的六位数字。
              </Typography>
              <Typography variant="body1" gutterBottom>
                首先，您需要通过安装 Google Authenticator 等双因素应用程序来设置设备。
              </Typography>
              <Typography variant="body1" gutterBottom>
                要生成验证码，请打开身份验证器应用程序并扫描下面的二维码。
              </Typography>
              {this.state.showQrCode ? (
                <img style={{ width: "256px", height: "256px" }} src={this.state.qrCodeData} />
              ) : (
                <Button
                  className={this.props.classes.button}
                  variant="outlined"
                  onClick={() => this.setState({ showQrCode: true })}
                >
                  显示二维码
                </Button>
              )}
            </div>
          )}
          <Typography variant="subheading" className={this.props.classes.section} gutterBottom>
            更多信息
          </Typography>
          <Typography variant="body1" gutterBottom>
            可以在
            <a
              href="https://hubs.mozilla.com/docs/hubs-cloud-accessing-servers.html"
              rel="noopener noreferrer"
              target="_blank"
            >
              服务器指南
            </a>
            中找到有关服务器设置和常见任务提示的文档。
          </Typography>
        </CardContent>
      </Card>
    );
  }
}

export const ServerAccess = withStyles(styles)(ServerAccessComponent);
