export const TERMS_VERSION = "beta-2026-09-19";
export const PRIVACY_VERSION = "beta-2026-09-19";

export const TERMS_TITLE = "Claim Scout Beta Terms of Use";
export const PRIVACY_TITLE = "Claim Scout Privacy Policy";

export const TERMS_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "What Claim Scout is",
    body: "Claim Scout is a research and source-scanning tool. It helps you search, organize, and review information from public and external sources about publicly described claims, airdrops, faucets, and similar offers. It is not a wallet, exchange, broker, or claims processor.",
  },
  {
    heading: "Closed Beta",
    body: "This version is a Closed Beta. Access is by invitation only. Features, limits, and availability can change. Beta software may contain defects. Please report problems so we can improve stability and result quality.",
  },
  {
    heading: "No guarantees",
    body: "Claim Scout does not guarantee discovery of any asset, reward, airdrop, or claim. It does not guarantee eligibility, payment, profit, monetary value, accuracy, or continued availability of third-party information. A result shown in Claim Scout is not a guarantee that you are eligible or that you will receive anything.",
  },
  {
    heading: "Third-party information",
    body: "External information may be incomplete, outdated, inaccurate, unavailable, or changed by the original provider. You must independently verify results before taking action. Third-party links and results are not automatically endorsements by Claim Scout.",
  },
  {
    heading: "No investment advice and no fund management",
    body: "Claim Scout does not provide investment advice. Claim Scout does not manage user funds. You remain responsible for your own decisions and for any transaction you approve in your own wallet.",
  },
  {
    heading: "Public addresses only",
    body: "Claim Scout does not require seed phrases or private keys. Wallet analysis uses public wallet addresses and other read-only data only. Never enter a seed phrase, recovery phrase, or private key into Claim Scout.",
  },
  {
    heading: "Acceptable use",
    body: "Use Claim Scout only on wallets and research you are authorized to review. Do not use the product to attack systems, steal credentials, or collect other people's secrets. We may suspend accounts that abuse the Beta, overload the service, or violate these terms.",
  },
  {
    heading: "Plans",
    body: "The Free plan is limited to a smaller source set and one wallet. Scout+ is a planned paid plan (target $40) with more sources and up to five wallets. Payment processing is not active in this Closed Beta. Plan limits are enforced on the server.",
  },
  {
    heading: "Changes",
    body: "We may update these Terms. Continued use after a new version is posted, and any in-product acceptance we ask for, means you accept the updated Terms. The version you accepted is stored with your account.",
  },
];

export const PRIVACY_SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "What we collect",
    body: "During Closed Beta we collect the minimum needed to operate a controlled test: account email, password hash (not the password), optional display name, invitation code used, Terms and Privacy acceptance (user ID, document versions, timestamp), public wallet addresses you choose to check, scan activity summaries, technical telemetry, feedback you submit, and security/application logs.",
  },
  {
    heading: "Why we collect it",
    body: "Account data authenticates you and isolates your work from other testers. Public wallet addresses power read-only eligibility checks you request. Telemetry and logs help us find crashes, source failures, and resource issues. Feedback helps us judge whether results are useful or broken.",
  },
  {
    heading: "Public wallet addresses",
    body: "If you paste or connect a wallet, Claim Scout stores the public address with your account so plan wallet limits can be enforced. Addresses are not private keys. You can clear a session in the product; operators may retain bound addresses while your Beta account exists so limits cannot be bypassed.",
  },
  {
    heading: "Technical telemetry",
    body: "We record events such as scan started, completed, or failed; duration; source or API failures; application errors; crashes; application version; and resource-limit events. Telemetry is not used to build advertising profiles.",
  },
  {
    heading: "Feedback and logs",
    body: "If you report a result, we store the feedback type, optional short note, and enough technical context to investigate (for example source name, result host, application version). Security logs record important events such as login failures and admin actions.",
  },
  {
    heading: "What Claim Scout does not collect",
    body: "Claim Scout does not request or intentionally collect seed phrases, private keys, or wallet recovery phrases. Do not paste them. If input looks like secret material, it is rejected and is not stored as a wallet or password.",
  },
  {
    heading: "Retention",
    body: "Beta account, telemetry, feedback, and logs are kept while the Closed Beta is running and for a limited period afterward so we can debug issues and protect the service. We do not keep information that is not necessary to operate or improve the Beta.",
  },
  {
    heading: "Security",
    body: "Passwords are stored as scrypt hashes. Sessions use signed HTTP-only cookies. User data is isolated by account. Admin access is separate from normal user access. Secrets belong in environment variables, not in source code.",
  },
  {
    heading: "Contact",
    body: "Use in-product feedback or your Beta operator contact to ask questions about this policy. We will post a new Privacy version if collection practices change.",
  },
];
