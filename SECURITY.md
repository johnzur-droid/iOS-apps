# GCP Security Best Practices

This document outlines the security framework for managing Google Cloud credentials used by the Calendar View and Order Tracker PWAs. It follows the recommendations from Google Cloud's security advisory.

---

## 1. Zero-Code Storage

**Never commit API keys or credentials to source code or version control.**

This project uses a `config.js` / `config.example.js` pattern:

- `config.example.js` — Template with placeholder values. Committed to the repository.
- `config.js` — Your actual credentials. **Gitignored.** Never committed.

### Setup

```bash
# Calendar app
cp config.example.js config.js
# Edit config.js with your credentials

# Order tracker
cp order-tracker/config.example.js order-tracker/config.js
# Edit order-tracker/config.js with your credentials
```

### If credentials were previously committed

If API keys or Client IDs were previously committed to git history, they should be considered compromised. Take these steps:

1. **Rotate the API Key** immediately in GCP Console > APIs & Services > Credentials
2. **Rotate the OAuth Client ID** by creating a new one and deleting the old
3. Consider using `git filter-branch` or [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) to scrub history (optional, since keys should be rotated anyway)

---

## 2. Enforce API Restrictions

**Never leave an API key unrestricted.** Apply both API-level and application-level restrictions.

### API Key Restrictions (Order Tracker)

1. Go to [GCP Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your API key
3. Under **Application restrictions**:
   - Select **HTTP referrers (websites)**
   - Add your allowed referrers:
     - `https://yourusername.github.io/*`
     - `http://localhost:8000/*` (for local development only)
4. Under **API restrictions**:
   - Select **Restrict key**
   - Choose only **Gmail API**
5. Click **Save**

### OAuth Client ID Restrictions

1. In GCP Console > APIs & Services > Credentials, click your OAuth Client ID
2. Under **Authorized JavaScript origins**, only list:
   - Your GitHub Pages domain (e.g., `https://yourusername.github.io`)
   - `http://localhost:8000` (for local dev)
3. Remove any origins you no longer use

---

## 3. Apply Least Privilege

**Never give full permissions to a service account or OAuth scope.**

This project already follows least privilege:

| App | OAuth Scope | Access Level |
|-----|------------|--------------|
| Calendar View | `calendar.readonly` | Read-only calendar access |
| Order Tracker | `gmail.readonly` | Read-only email access |

### Audit checklist

- [ ] Verify no service accounts have `roles/owner` or `roles/editor`
- [ ] Use IAM Recommender to prune unused permissions: [GCP IAM Recommender](https://console.cloud.google.com/iam-admin/iam)
- [ ] Ensure OAuth consent screen scopes match the minimum needed

---

## 4. Disable Dormant Keys

**Audit active keys and decommission any showing no activity in 30+ days.**

### How to audit

1. Go to [GCP Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
2. Review all API keys and OAuth Client IDs
3. Check usage metrics in [APIs & Services > Dashboard](https://console.cloud.google.com/apis/dashboard)
4. Delete or disable any credentials not actively in use
5. Review service accounts at [IAM & Admin > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)

### Recommended schedule

- **Monthly**: Review API key usage metrics
- **Quarterly**: Full credential audit (delete unused keys, rotate active ones)

---

## 5. Mandatory Key Rotation

**Enforce a maximum lifespan for all user-managed service account keys.**

### Organization policy (if applicable)

If you manage a GCP organization, apply these constraints:

```
# Enforce maximum key lifespan (e.g., 90 days)
constraints/iam.serviceAccountKeyExpiryHours

# Disable creation of new service account keys entirely (if not needed)
constraints/iam.managed.disableServiceAccountKeyCreation
```

### For this project

Since this project uses OAuth Client IDs and API Keys (not service account keys), rotation is manual:

1. **API Key rotation**: Create a new API key in GCP Console, update your local `config.js`, then delete the old key
2. **OAuth Client ID rotation**: Create a new OAuth Client ID, update `config.js`, then delete the old one
3. **Recommended frequency**: Every 90 days, or immediately if a credential is suspected compromised

---

## 6. Operational Safeguards

### Essential Contacts

Verify your GCP Essential Contacts are up to date so critical security notifications reach the right people:

1. Go to [Essential Contacts](https://console.cloud.google.com/iam-admin/essential-contacts)
2. Ensure contacts are set for:
   - **Security** notifications
   - **Technical** notifications
   - **Billing** notifications

### Billing Anomaly and Budget Alerts

A sudden spike in API usage is often the first indicator of a compromised credential.

1. Go to [Billing > Budgets & Alerts](https://console.cloud.google.com/billing/budgets)
2. Create a budget with alerts at 50%, 80%, and 100% thresholds
3. Enable billing anomaly detection in [Billing > Overview](https://console.cloud.google.com/billing)
4. Ensure alert notifications go to your email

---

## 7. Security Checklist

Use this checklist to verify your environment is secure:

- [ ] **No credentials in source code** — all API keys/Client IDs are in gitignored `config.js` files
- [ ] **`.gitignore` is in place** — `config.js` files are excluded from version control
- [ ] **API key is restricted** — limited to Gmail API only, with HTTP referrer restrictions
- [ ] **OAuth Client ID is restricted** — authorized JavaScript origins limited to your deployment domains
- [ ] **Read-only scopes** — using `calendar.readonly` and `gmail.readonly`
- [ ] **Unused credentials disabled** — dormant keys and service accounts are removed
- [ ] **Essential Contacts configured** — security notifications reach the right people
- [ ] **Budget alerts active** — billing anomaly detection is enabled
- [ ] **Key rotation scheduled** — credentials are rotated every 90 days
- [ ] **Git history reviewed** — previously committed credentials have been rotated

---

## 8. Incident Response

If you suspect a credential has been compromised:

1. **Immediately** revoke the credential in [GCP Console > Credentials](https://console.cloud.google.com/apis/credentials)
2. **Create** a new credential and update your local `config.js`
3. **Review** API usage logs in [APIs & Services > Dashboard](https://console.cloud.google.com/apis/dashboard) for unauthorized activity
4. **Check** [Cloud Audit Logs](https://console.cloud.google.com/logs) for suspicious access patterns
5. **Review** billing for unexpected charges

---

## References

- [Google Cloud: Managing API Keys](https://cloud.google.com/docs/authentication/api-keys)
- [Google Cloud: Best Practices for Service Accounts](https://cloud.google.com/iam/docs/best-practices-service-accounts)
- [Google Cloud: OAuth 2.0 for Client-side Applications](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
- [OWASP: Credential Management](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Management_Cheat_Sheet.html)
