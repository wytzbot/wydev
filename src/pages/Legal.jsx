import React from "react";

const CONTENT = {
  contact: { label: "SUPPORT", title: "Contact Us", sections: [["Email", "For payment issues, bugs, account access problems, or general support, contact wytetechcompany@gmail.com."], ["Payment support", "Include the GitHub username, approximate transaction time, and the error shown by WyteLab. Never send your card number, CVV, PIN, OTP, password, or access token."], ["Security reports", "Report suspected security problems privately by email so they can be investigated without exposing repository or account data."]] },
  privacy: {
    label: "PRIVACY",
    title: "Privacy Policy",
    sections: [
      ["What we collect", "WyteLab collects the information needed to authenticate your Google and/or GitHub account, connect you to repositories you choose to use, operate the workspace, and provide billing services. We aim to collect only what is necessary for these functions."],
      ["Account sign-in", "You can sign in with Google using the openid, email, and profile scopes. Google SSO creates the WyteLab account session. Repository features still require a connected GitHub account because GitHub remains the source of truth for repository access. You can also sign in directly with GitHub."],
      ["GitHub access", "When you connect or sign in with GitHub, WyteLab uses the permissions granted during authorization to perform actions you request, such as reading repositories, editing files, and creating or updating repository content. WyteLab does not claim ownership of your code."],
      ["Payments", "Payments are processed through our payment provider. WyteLab does not intentionally store your full card number, CVV, or card PIN. Payment authorization data is handled through the payment flow provided by the payment processor."],
      ["Data use", "We use account and service data to operate WyteLab, prevent abuse, troubleshoot failures, maintain security, and provide requested features. We do not sell your private repository content."],
      ["Your responsibility", "Keep your GitHub account and devices secure. Review the permissions shown during GitHub authorization and revoke access from GitHub when you no longer want WyteLab connected."],
      ["Google Drive (optional)", "If you connect Google Drive, WyteLab requests the Google identity scopes openid, email, and profile to identify/display the Google account, plus the drive.file scope to create and access the files WyteLab creates for you (such as exported repository ZIPs). WyteLab does not request access to your Gmail, Calendar, Docs, Sheets, or all of your existing Drive files. Google authorization data is handled under the Google API Services User Data Policy, including its Limited Use requirements. You can disconnect WyteLab from Developer Hub or revoke its Google access from your Google Account permissions."],
    ]
  },
  terms: {
    label: "LEGAL",
    title: "Terms of Service",
    sections: [
      ["Using WyteLab", "WyteLab is a developer workspace that helps you work with GitHub repositories. You are responsible for the repositories, code, credentials, and content you access or modify through the service."],
      ["Acceptable use", "Do not use WyteLab to violate GitHub rules, applicable law, intellectual-property rights, privacy rights, or the rights of other users. Do not attempt to bypass security controls, abuse service limits, or interfere with the service."],
      ["GitHub and third parties", "GitHub remains the source of truth for your repositories. GitHub, payment providers, and other third-party services are governed by their own terms and policies."],
      ["Subscriptions", "Pro features require an active subscription. Pricing, included features, renewal terms, and availability may change with reasonable notice. If a payment fails, access to Pro features may be restricted until the subscription is restored."],
      ["No guarantee", "WyteLab is provided to help with development workflows, but you should keep appropriate backups and review changes before committing or pushing important code. We are not responsible for loss caused by your own code, repository configuration, or third-party service outages."],
    ]
  },
  about: {
    label: "WyteLab",
    title: "About WyteLab",
    sections: [
      ["Built for developers", "WyteLab is a focused mobile-friendly developer workspace built around GitHub. It brings repository browsing, file editing, changes, search, commits, and project workflows into one streamlined interface."],
      ["GitHub-first", "Your repositories stay on GitHub. WyteLab is designed as a productivity layer on top of GitHub rather than a replacement for Git hosting."],
      ["Simple by design", "The goal is fast access to the tools developers use most, without turning the interface into a social feed or an unnecessarily complicated IDE."],
      ["Support", "For help with a specific workflow, use the Help section inside WyteLab and check the error message shown by the app before retrying an operation."],
    ]
  }
};

export default function LegalPage({ type }) {
  const data = CONTENT[type] || CONTENT.about;
  return (
    <div className="page legalPage">
      <header><div><span className="eyebrow">{data.label}</span><h1>{data.title}</h1></div></header>
      <section className="panel legalPanel">
        {data.sections.map(([heading, body]) => (
          <details className="legalSection" key={heading} open={type === "about"}>
            <summary>{heading}</summary>
            <p>{body}</p>
          </details>
        ))}
        <p className="muted legalNote">Last updated: September 14, 2026. These pages describe the current WyteLab product and may be updated as the service evolves.</p>
      </section>
    </div>
  );
}
