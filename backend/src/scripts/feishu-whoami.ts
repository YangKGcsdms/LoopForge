/**
 * 一次性引导脚本：起飞书长连接，监听收到的消息，打印发送者 open_id / chat_id。
 *
 * 用法（在 backend 目录）：
 *   node --import tsx src/scripts/feishu-whoami.ts
 * 然后用飞书给这个机器人发任意一条消息，终端会打出你的 open_id，
 * 填进 backend/.env 的 FEISHU_RECEIVE_ID（群审批则用打印的 chat_id 并把 TYPE 改成 chat_id）。
 */
import "../env.js"; // 触发 .env 加载
import * as lark from "@larksuiteoapi/node-sdk";

const appId = process.env.FEISHU_APP_ID;
const appSecret = process.env.FEISHU_APP_SECRET;
if (!appId || !appSecret) {
  console.error("缺 FEISHU_APP_ID / FEISHU_APP_SECRET（检查 backend/.env）");
  process.exit(1);
}

const ws = new lark.WSClient({ appId, appSecret });
const dispatcher = new lark.EventDispatcher({}).register({
  "im.message.receive_v1": async (data: unknown) => {
    const d = data as { sender?: { sender_id?: { open_id?: string } }; message?: { chat_id?: string } };
    console.log("\n================ 收到消息 ================");
    console.log("open_id :", d?.sender?.sender_id?.open_id);
    console.log("chat_id :", d?.message?.chat_id);
    console.log("把 open_id 填进 backend/.env 的 FEISHU_RECEIVE_ID");
    console.log("=========================================\n");
    return undefined;
  },
});

ws.start({ eventDispatcher: dispatcher });
console.log("飞书长连接已起。请用飞书给机器人发一条消息（任意内容）……");
