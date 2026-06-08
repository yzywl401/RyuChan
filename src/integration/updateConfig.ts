import type { AstroIntegration } from "astro";
import path from "node:path";
import fs from "node:fs/promises";
import yaml from "js-yaml";

// 占位符值，这些值不会从 YAML 同步
const PLACEHOLDER_VALUES = ["在部署端配置环境变量", "-", ""];

interface GithubConfig {
  owner?: string;
  repo?: string;
  branch?: string;
  appId?: string;
  encryptKey?: string;
}

async function syncEnvFile() {
  const configPath = path.resolve("ryuchan.config.yaml");
  const envPath = path.resolve(".env");

  try {
    const configContent = await fs.readFile(configPath, "utf8");
    const config = yaml.load(configContent) as { github?: GithubConfig };
    const github = config?.github || {};

    // 读取现有 .env 内容
    let existingEnv: Map<string, string> = new Map();
    try {
      const envContent = await fs.readFile(envPath, "utf8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex).trim();
          const value = trimmed.slice(eqIndex + 1).trim();
          existingEnv.set(key, value);
        }
      }
    } catch {
      // .env 文件不存在，继续创建
    }

    // 映射关系
    const mapping: { yamlKey: keyof GithubConfig; envKey: string; default: string }[] = [
      { yamlKey: "owner", envKey: "PUBLIC_GITHUB_OWNER", default: "kobaridev" },
      { yamlKey: "repo", envKey: "PUBLIC_GITHUB_REPO", default: "RyuChan" },
      { yamlKey: "branch", envKey: "PUBLIC_GITHUB_BRANCH", default: "main" },
      { yamlKey: "appId", envKey: "PUBLIC_GITHUB_APP_ID", default: "" },
      { yamlKey: "encryptKey", envKey: "PUBLIC_GITHUB_ENCRYPT_KEY", default: "wudishiduomejimo" },
    ];

    const newEnv = new Map(existingEnv);
    let changed = false;

    for (const { yamlKey, envKey, default: defaultValue } of mapping) {
      const yamlValue = github[yamlKey] as string | undefined;
      const existingValue = existingEnv.get(envKey);

      // 如果 YAML 值是占位符，保留现有值
      if (PLACEHOLDER_VALUES.includes(yamlValue || "")) {
        if (!existingValue) {
          newEnv.set(envKey, defaultValue || "");
        }
        continue;
      }

      // 使用 YAML 值或默认值
      const finalValue = yamlValue || defaultValue;
      if (existingValue !== finalValue) {
        newEnv.set(envKey, finalValue);
        changed = true;
      }
    }

    if (!changed && existingEnv.size > 0) {
      return; // 无变化
    }

    // 生成 .env 内容
    const envContent = [
      "# GitHub App Configuration",
      "# 此文件由 Astro 构建自动同步生成",
      "",
      `# 你的 GitHub 用户名`,
      `PUBLIC_GITHUB_OWNER=${newEnv.get("PUBLIC_GITHUB_OWNER") || "kobaridev"}`,
      "",
      "# 你的仓库名称",
      `PUBLIC_GITHUB_REPO=${newEnv.get("PUBLIC_GITHUB_REPO") || "RyuChan"}`,
      "",
      "# 你的仓库分支",
      `PUBLIC_GITHUB_BRANCH=${newEnv.get("PUBLIC_GITHUB_BRANCH") || "main"}`,
      "",
      "# 你的 GitHub App ID",
      `PUBLIC_GITHUB_APP_ID=${newEnv.get("PUBLIC_GITHUB_APP_ID") || ""}`,
      "",
      "# 用于加密存储私钥的密钥",
      `PUBLIC_GITHUB_ENCRYPT_KEY=${newEnv.get("PUBLIC_GITHUB_ENCRYPT_KEY") || "wudishiduomejimo"}`,
    ].join("\n") + "\n";

    await fs.writeFile(envPath, envContent, "utf8");
    console.log("[update-config] .env 文件已同步");
  } catch (e) {
    console.error("[update-config] 同步 .env 失败:", e);
  }
}

export default (): AstroIntegration => ({
  name: "update-config",
  hooks: {
    "astro:config:setup": async (options) => {
      const { addWatchFile } = options;
      addWatchFile(path.resolve("ryuchan.config.yaml"));
      addWatchFile(path.resolve("src/i18n/translations.yaml"));

      // 构建时同步 .env 文件
      await syncEnvFile();
    },
  },
});
