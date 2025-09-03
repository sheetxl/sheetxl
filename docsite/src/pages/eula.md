# End-User License Agreement (EULA)

For SheetXL Software
Effective: September 2025
___

**IMPORTANT: READ CAREFULLY.** This End-User License Agreement (“Agreement” or “EULA”) is a legally binding contract between you (“Licensee”) and SheetXL, Inc. (“SheetXL”) governing your use of the SheetXL software and related materials (the “SOFTWARE”). By installing, copying, or otherwise using the SOFTWARE, you agree to be bound by this Agreement. If you do not agree, do not install or use the SOFTWARE.
___

### **I. DEFINITIONS**

For purposes of this Agreement:

**Application** – A unique software product or service that incorporates the SOFTWARE, identified by both a single signing authority (e.g., app store bundle ID, domain, or equivalent) and a single core codebase.

1. Permitted Variants. An Application may include variants that differ only by configuration, branding, localization, or customer-specific settings, provided they share the same core codebase and signing authority.

2. Multi-Tenant SaaS. Multiple tenants or domains served from the same core codebase under the same signing authority are treated as one Application.

3. Feature-Switch Exception. If the same codebase is used to deliver offerings that differ in core functionality, workflows, or modules such that they are marketed, sold, or licensed as distinct products or SKUs, each such offering counts as a separate Application and requires its own Application License.

4. Forks. Any fork, branch, or derivative build deployed in production that introduces functionality beyond configuration, branding, or localization is a separate Application and requires its own Application License.

5. API / Backend Services. Where the SOFTWARE is deployed in a server-side or API-only role, each Application is determined by the signing authority of the consuming client application (e.g., web domain, mobile bundle ID, or equivalent). Multiple independently signed front-ends consuming the same backend each count as separate Applications.

6. Non-Production Environments. Development, QA, staging, or testing environments that support the same Application are included.

**Developer** – Any natural person who has write or merge access to source code that incorporates the SOFTWARE into
one or more Applications, whether as an employee, contractor, or agent of Licensee. Each Developer is counted
once for licensing purposes, even if they contribute to multiple Applications.

* **Exclusions**:

1. Automated or service accounts (CI/CD, dependency bots).

2. External contributors without write access whose contributions were not merged.

3. Personnel with write access solely to repositories that do not include the SOFTWARE and do not build/package it.

**Application Codebase** – The set of repositories (including monorepos or submodules) used to build, package, or deploy one or more Applications that incorporate the SOFTWARE. A single Application Codebase may include multiple Applications.

**Server** – A single physical or virtual instance of the SOFTWARE deployed in a server-side environment (e.g., Node.js runtime, calculation server, or importer).

**License Key** – A unique key or mechanism provided by SheetXL to enable deployment of the SOFTWARE within an Application or Server.

**Documentation** – The instructions, specifications, and usage materials provided with the SOFTWARE.

**SOFTWARE** – The SheetXL libraries, executables, documentation, updates, upgrades, and redistributable components provided under this Agreement.

### **II. GRANT OF LICENSE**

Subject to Licensee’s compliance with this Agreement and payment of applicable fees (under a separate Order Form or Pricing Schedule):

1. **Application License.** Licensee may incorporate the SOFTWARE into a single Application and deploy it to end-users.
An Application License includes both (a) Client Deployment (deployment of the SOFTWARE in client-side environments such
as browsers, mobile apps, or desktop apps), and (b) Server Deployment (deployment of the SOFTWARE in server-side
environments such as Node.js runtimes, calculation servers, or data importers). Deployment to additional Applications
requires additional licenses. Non-production environments (e.g., development, QA, staging) supporting the same
Application are included.
2. **Developer License.** Licensee may permit the number of Developers (as defined in this Agreement) authorized by
License to use the SOFTWARE for development of an Application under a paid commercial license.
Each Developer requires a separate Developer License.
3. **Community License.** SheetXL makes available a free 'Community Version' of the SOFTWARE. Subject to the terms of this Agreement:
   * **Grant.** Licensee may use the Community Version internally for evaluation, learning, or non-commercial purposes only.
   * **Watermark.** The Community Version may display a visual watermark or other notice.
   * **Commercial Use.** Use of the Community Version in any production or commercial environment is strictly prohibited. To use the SOFTWARE without the watermark or for any commercial purpose, Licensee must obtain a paid license.
   * **Disclaimer.** The Community Version is provided "AS IS" without warranty, and Licensee is not entitled to any support or maintenance for it.

### **III. PROHIBITED USES**

Licensee shall not:

1. **Prohibited Use – Wrappers and Competing Components.** Use the SOFTWARE to create, distribute, or license any product that (a) substantially replicates or competes with the SOFTWARE, or (b) acts as a shell, wrapper, or pass-through component that exposes the SOFTWARE’s functionality to unlicensed third parties. This restriction does not limit Licensee’s right to embed the SOFTWARE within a licensed Application in accordance with this Agreement.
2. **Tampering with Licensing Mechanisms.** Licensee must not remove, obscure, alter, disable, or otherwise attempt to
circumvent any watermark, license validation, or other licensing mechanism embedded in the SOFTWARE, regardless of license type.
3. Rent, lease, sublicense, or otherwise make the SOFTWARE available except as expressly permitted herein.
4. Reverse engineer, decompile, or disassemble the SOFTWARE, except where such activity is expressly permitted by
applicable law for the sole purpose of achieving interoperability.
5. Disclose or distribute any License Key other than as authorized by SheetXL.
6. Use the SOFTWARE in violation of any applicable law, regulation, or third-party rights.
7. **High-Risk Use.** Use the SOFTWARE in any application or situation where failure of the SOFTWARE could lead to death, personal injury, or severe physical or environmental damage (e.g., operation of nuclear facilities, aircraft navigation, or life support systems).

### **IV. SUPPORT AND MAINTENANCE**

For paid licenses, and for the duration of the license term, Licensee is entitled to receive SOFTWARE updates and standard technical support as described in SheetXL's then-current Support Policy, which is incorporated by reference. SheetXL is under no obligation to provide support for Community Versions or for licenses that have expired.

### **V. AUDIT RIGHTS**

SheetXL may, upon reasonable notice, audit Licensee’s use of the SOFTWARE to verify compliance. Any audit will be
reasonable and proportionate, and Licensee agrees to cooperate in good faith, including providing reasonable
demonstrations (e.g., repository access counts, screen-sharing, or other agreed method).

### **VI. INTELLECTUAL PROPERTY**

1. **Ownership.** The SOFTWARE is licensed, not sold. SheetXL and its licensors retain all rights, title, and interest in and to the SOFTWARE.
2. **Feedback.** If Licensee voluntarily provides suggestions, ideas, or other feedback to SheetXL concerning the SOFTWARE (“Feedback”), Licensee grants SheetXL a perpetual, irrevocable, royalty-free, worldwide license to use such Feedback. Feedback does not include routine error reports, support requests, or other communications submitted in the ordinary course of using the SOFTWARE.
3. **Copies.** Licensee may make copies of the SOFTWARE solely for backup and archival purposes.
4. **Reservation of Rights.** Except as expressly granted, no rights are conveyed.

### **VII. LIMITED WARRANTY & DISCLAIMER**

1. **Limited Warranty.** SheetXL warrants that it has the right to license the SOFTWARE.
2. **Disclaimer.** EXCEPT AS SET FORTH ABOVE, THE SOFTWARE IS PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
3. **Risk.** The entire risk as to performance, accuracy, or results of using the SOFTWARE rests with Licensee.

### **VIII. INDEMNIFICATION & LIMITATION OF LIABILITY**

1. **Licensee Indemnity.** Licensee shall indemnify and hold harmless SheetXL from any claim, damage, or liability arising from (i) Licensee’s use or distribution of the SOFTWARE, (ii) Licensee’s Applications, or (iii) breach of this Agreement.
2. **Limitation of Liability.** TO THE MAXIMUM EXTENT PERMITTED BY LAW, SHEETXL SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES, INCLUDING LOST PROFITS, BUSINESS INTERRUPTION, OR DATA LOSS, EVEN IF ADVISED OF THE POSSIBILITY. SHEETXL’S TOTAL LIABILITY SHALL NOT EXCEED FEES PAID BY LICENSEE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.

### **IX. TERM AND TERMINATION**

1. **Term.** Each license runs for twelve (12) months from the date of purchase, unless otherwise specified.
2. **Renewal.** Renewal of any license is available upon payment of the applicable fees and is subject to Licensee’s
continued compliance with this Agreement. SheetXL may update the terms of this Agreement upon renewal, and will make updated terms reasonably available prior to renewal. Continued use of the SOFTWARE after renewal constitutes acceptance of the updated terms.
3. **Termination.** SheetXL may terminate this Agreement if Licensee materially breaches its terms and fails to cure
such breach within a reasonable time after receiving notice, except that SheetXL reserves the right to terminate
immediately in cases of intentional misuse, unauthorized distribution, or other material violations that cannot be remedied.
4. **Effect of Termination.** Upon termination or expiration, Licensee must cease all development and distribution of the SOFTWARE and destroy all copies in its possession. Licensee acknowledges that the SOFTWARE includes a license validation mechanism and that upon expiration of the license term, the SOFTWARE may automatically revert to a feature-limited, watermarked, or disabled state. While this Agreement's termination does not revoke the right of Licensee's end-users to continue using Applications distributed prior to termination, their continued use is subject to the SOFTWARE functioning in such a degraded state.

### **X. MISCELLANEOUS**

1. **Entire Agreement.** This Agreement is the complete and exclusive statement of the agreement between the parties and supersedes all prior oral or written agreements, communications, or understandings. This Agreement may not be modified except by a written instrument signed by a duly authorized representative of each party.
2. **Assignment.** Licensee may not assign this Agreement without SheetXL’s prior written consent. SheetXL may assign to an affiliate or successor.
3. **Governing Law.** This Agreement is governed by the laws of the State of New York. Any disputes shall be resolved in New York County, New York.
4. **Severability.** If any provision is held unenforceable, the remainder shall remain in effect.
5. **Waiver.** Failure to enforce any provision shall not constitute a waiver of future enforcement.
6. **Survival.** Sections I, III, V, VI, VII, VIII, IX.4, and X shall survive any termination or expiration of this Agreement.
7. **Export Controls.** The SOFTWARE is subject to U.S. export laws. Licensee agrees to comply with all applicable international and national laws that apply to the SOFTWARE, including the U.S. Export Administration Regulations.
8. **Notices.** All notices must be in writing. Notices to SheetXL shall be sent to legal@sheetxl.com. Notices to Licensee shall be sent to the email address provided during license registration.
9. **Open Source Software.** The SOFTWARE may include third-party open-source components, which are subject to their own applicable licenses. A list of such components and their licenses may be found in the SOFTWARE’s documentation or an accompanying file. This EULA does not limit your rights under, or grant you rights that supersede, the license terms of any such open-source components.
10. **Statute of Limitations.** To the extent permitted by law, any claim or cause of action arising out of or related to this Agreement must be filed within one (1) year after such claim or cause of action arose or be forever barred.