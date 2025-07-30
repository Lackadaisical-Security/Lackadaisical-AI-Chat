# 🔒 Security Policy - Lackadaisical AI Chat

## 🛡️ Reporting Security Vulnerabilities

We take the security of Lackadaisical AI Chat seriously. If you discover a security vulnerability, please report it responsibly.

### 📧 How to Report

**For Security Issues:**
- **Email**: security@lackadaisical-security.com (if available) or create a private GitHub security advisory
- **GitHub**: Use "Security" tab -> "Report a vulnerability" for private disclosure
- **Response Time**: We aim to respond within 24-48 hours

**Please Include:**
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Suggested fix (if available)
- Your contact information for follow-up

### 🚫 Please Do NOT:
- Post security issues in public GitHub issues
- Disclose vulnerabilities publicly before we've had time to address them
- Test vulnerabilities on systems you don't own

## 🌍 Export Control and Legal Restrictions

### 🇺🇸 US Export Administration Regulations (EAR)

This software may be subject to US Export Administration Regulations. By downloading or using this software, you acknowledge and agree to comply with all applicable export control laws.

**⚠️ RESTRICTED COUNTRIES AND ENTITIES:**

This software is **NOT AUTHORIZED** for export, re-export, or use by:

#### Embargoed Countries (Subject to Change):
- **Cuba** 🇨🇺
- **Iran** 🇮🇷  
- **North Korea** 🇰🇵
- **Syria** 🇸🇾
- **Crimea Region** (Ukraine)
- **Donetsk People's Republic** (Ukraine)
- **Luhansk People's Republic** (Ukraine)

#### Restricted Entities:
- Individuals or entities on the US Bureau of Industry and Security (BIS) **Entity List**
- Individuals or entities on the US Treasury Department **Specially Designated Nationals (SDN) List**
- Individuals or entities on other US government restricted party lists
- Any party engaged in activities related to weapons of mass destruction

#### Additional Restrictions:
- **Military End Users** in China, Russia, or Venezuela (without proper licensing)
- **Government End Users** in certain countries (consult current EAR regulations)
- Any use that supports **nuclear, chemical, or biological weapons** development
- Any use that supports **missile technology** development

### 📋 User Responsibility

By using this software, you represent and warrant that:

1. **You are not located** in an embargoed country or restricted region
2. **You are not listed** on any US government restricted party list
3. **You will not export** or re-export the software to restricted parties or countries
4. **You will comply** with all applicable export control laws and regulations
5. **You will not use** the software for any prohibited end uses

### 🔍 Compliance Verification

We may implement automated checks to help ensure compliance, including:
- **IP geolocation screening** (blocking access from restricted regions)
- **Entity list screening** for commercial license applications
- **End-use monitoring** for commercial deployments
- **Regular compliance audits** for enterprise customers

## 🔐 Security Features

### 🏠 Privacy by Design
- **Local Data Storage** - All conversations stored locally on user's machine
- **No Cloud Transmission** - AI processing happens locally via Ollama
- **Optional Encryption** - AES-256 encryption for conversation database
- **No Telemetry** - Zero data collection or transmission to external servers

### 🛡️ Data Protection
- **SQLite Database** - Secure local storage with optional encryption
- **Environment Variables** - Sensitive configuration stored in .env files
- **API Key Security** - External AI provider keys stored securely
- **Session Management** - Secure session handling and cleanup

### 🔒 Network Security
- **CORS Protection** - Proper Cross-Origin Resource Sharing configuration
- **Local Network Only** - Default configuration binds to localhost only
- **HTTPS Support** - SSL/TLS encryption for production deployments
- **Rate Limiting** - Protection against API abuse

### 👤 Authentication (When Enabled)
- **Password Hashing** - bcrypt for secure password storage
- **Session Tokens** - Secure session management
- **JWT Support** - JSON Web Tokens for API authentication
- **2FA Ready** - Framework supports two-factor authentication

## 🔧 Security Configuration

### 🔐 Recommended Security Settings

**Production Deployment:**
```env
# Enable database encryption
DATABASE_ENCRYPTION=true
DATABASE_KEY=your-32-character-encryption-key

# Use HTTPS
USE_HTTPS=true
SSL_CERT_PATH=/path/to/certificate.pem
SSL_KEY_PATH=/path/to/private-key.pem

# Restrict network access
BIND_ADDRESS=127.0.0.1  # localhost only
# Or specific interface: BIND_ADDRESS=192.168.1.100

# Enable rate limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=3600  # 1 hour

# Secure headers
ENABLE_SECURITY_HEADERS=true
CONTENT_SECURITY_POLICY=default-src 'self'
```

**API Key Security:**
```env
# External AI providers (optional)
OPENAI_API_KEY=sk-your-secure-key
ANTHROPIC_API_KEY=your-secure-key
GOOGLE_API_KEY=your-secure-key

# Keep these secure and never commit to version control
```

### 🔍 Security Monitoring

**Log Security Events:**
- Failed authentication attempts
- Unusual API usage patterns
- Database access errors
- Network connection anomalies

**Regular Security Tasks:**
- Update dependencies regularly
- Monitor security advisories
- Review access logs
- Backup encrypted data
- Test disaster recovery

## 🚨 Incident Response

### 🔴 If You Suspect a Security Breach:

1. **Immediate Actions:**
   - Stop the affected services
   - Preserve logs and evidence
   - Assess the scope of potential impact
   - Secure any compromised credentials

2. **Contact Information:**
   - **Security Team**: security@lackadaisical.ai
   - **Emergency Contact**: [Phone number if available]
   - **GitHub Security**: Use private security advisory

3. **Documentation:**
   - Record timeline of events
   - Document affected systems
   - List potential data exposure
   - Note remediation steps taken

### 🔧 Security Updates

We will provide security updates through:
- **GitHub Security Advisories** for public disclosure
- **Email notifications** for enterprise customers
- **Release notes** with security fix details
- **Patch releases** for critical vulnerabilities

## 📚 Security Resources

### 🔗 External Resources:
- **US Export Control**: [Bureau of Industry and Security](https://www.bis.doc.gov/)
- **Security Best Practices**: [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- **Node.js Security**: [Node.js Security Guidelines](https://nodejs.org/en/security/)
- **SQLite Security**: [SQLite Security Documentation](https://www.sqlite.org/security.html)

### 📖 Internal Documentation:
- **Installation Guide**: See INSTALL.md for secure setup
- **Contributing Guide**: See CONTRIBUTING.md for secure development
- **Troubleshooting**: See TROUBLESHOOTING.md for security issues

## ⚖️ Legal Compliance

### 📋 Required Disclosures:

**Export Control Notice:**
This software contains technology that may be subject to US export controls. Export, re-export, or use of this technology may require prior authorization from the US government.

**Encryption Notice:**
This software may contain encryption technology. Import, use, or export of this software may be restricted in certain countries.

**Privacy Notice:**
This software processes personal data locally on your device. Users are responsible for complying with applicable privacy laws in their jurisdiction.

### 🌐 International Users:

**European Union (GDPR):**
- Users are the data controllers for their own data
- All processing happens locally on user devices
- No data transfer to third parties by default

**Other Jurisdictions:**
- Users must comply with local laws and regulations
- Export control laws may apply to international use
- Professional legal advice recommended for commercial use

## 📞 Contact Information

**Security Team:**
- **Email**: security@lackadaisical-security.com
- **GitHub**: @LackadaisicalSecurity (Security issues)
- **Response Time**: 24-48 hours for security reports

**Legal Compliance:**
- **Export Control Questions**: legal@lackadaisical-security.com
- **Privacy Questions**: privacy@lackadaisical-security.com
- **General Legal**: legal@lackadaisical-security.com

---

## 🔄 Security Policy Updates

**Version History:**
- v1.0 (2025-07-30) - Initial security policy

**Update Notification:**
Security policy changes will be announced through:
- GitHub repository releases
- Security advisory notifications
- Email alerts for enterprise customers
- Community Discord announcements

---

**Last Updated:** July 30, 2025  
**Policy Version:** 1.0  
**Jurisdiction:** United States of America

*This security policy is designed to protect users, comply with legal requirements, and maintain the security and integrity of the Lackadaisical AI Chat project.*
