#!/usr/bin/env node
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const APPLY = process.argv.includes('--apply');
const CONFIRM = process.argv.includes('--confirm') && process.argv.includes('CAREER_SHELLS_ONLY');
const OPERATOR = process.argv.includes('--operator')
  ? process.argv[process.argv.indexOf('--operator') + 1]
  : 'career-catalog-seed';

if (APPLY && !CONFIRM) {
  throw new Error('Use --apply --confirm CAREER_SHELLS_ONLY to create missing private certification shells');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const rootCategories = [
  ['enterprise-applications', 'Enterprise Applications', 'SAP, Oracle ERP, CRM, finance and enterprise workflow platforms.', 'BriefcaseBusiness', 60],
  ['cloud-devops', 'Cloud and DevOps', 'AWS, Azure, containers, CI/CD and reliability operations.', 'CloudCog', 30],
  ['data-ai-analytics', 'Data, AI and Analytics', 'Data analysis, applied AI, machine learning and generative AI.', 'BrainCircuit', 20],
  ['software-engineering', 'Software Engineering', 'Programming, APIs, testing and engineering fundamentals.', 'Code2', 10],
  ['cybersecurity', 'Cybersecurity', 'Security fundamentals, cloud security and operational risk awareness.', 'ShieldCheck', 40],
  ['product-business-technology', 'Product and Business Technology', 'Product, business analysis and digital operations skills.', 'BriefcaseBusiness', 50],
  ['it-operations-support', 'IT Operations and Support', 'Service desk, systems, networking and workplace technology operations.', 'ServerCog', 70],
];

const assessments = [
  ['sap-s4hana-finance-foundations', 'SAP S/4HANA Finance Skills', 'enterprise-applications', 'Independent Octamy assessment of ERP finance processes, master data, postings and reporting skills used in SAP S/4HANA roles.', 'intermediate', 45, 70, 149],
  ['sap-mm-procurement-foundations', 'SAP MM Procurement Foundations', 'enterprise-applications', 'Procure-to-pay, purchasing documents, inventory movement and vendor process fundamentals.', 'intermediate', 45, 70, 149],
  ['oracle-erp-cloud-financials-foundations', 'Oracle ERP Cloud Financials Skills', 'enterprise-applications', 'Independent Octamy assessment of Oracle Cloud financials, ledgers, payables, receivables and close-process skills.', 'intermediate', 45, 70, 149],
  ['salesforce-crm-admin-foundations', 'Salesforce CRM Administration Skills', 'enterprise-applications', 'Independent Octamy assessment of CRM objects, users, permissions, automation and reporting skills used in Salesforce administration.', 'novice', 40, 70, 99],
  ['aws-cloud-practitioner-foundations', 'AWS Cloud Foundations Skills', 'cloud-devops', 'Independent Octamy assessment of AWS core services, billing, security, networking and cloud operating-model skills.', 'novice', 40, 70, 99],
  ['azure-fundamentals-az-900-readiness', 'Microsoft Azure Foundations Skills', 'cloud-devops', 'Independent Octamy assessment of Azure compute, storage, identity, networking, pricing and governance skills.', 'novice', 40, 70, 99],
  ['devops-ci-cd-foundations', 'DevOps CI/CD Foundations', 'cloud-devops', 'Version control, pipelines, release safety, observability and deployment automation fundamentals.', 'intermediate', 45, 70, 149],
  ['kubernetes-foundations', 'Kubernetes Foundations', 'cloud-devops', 'Pods, deployments, services, configuration, scaling and operational basics for Kubernetes workloads.', 'intermediate', 45, 70, 149],
  ['ai-fundamentals-for-work', 'AI Fundamentals for Work', 'data-ai-analytics', 'Practical AI vocabulary, model limitations, data privacy, prompts and safe workplace AI adoption.', 'novice', 35, 70, 99],
  ['generative-ai-prompt-engineering-foundations', 'Generative AI Prompt Engineering Foundations', 'data-ai-analytics', 'Prompt design, evaluation, grounding, safety controls and workflow automation with generative AI.', 'novice', 40, 70, 99],
  ['machine-learning-foundations', 'Machine Learning Foundations', 'data-ai-analytics', 'Supervised learning, metrics, features, validation and practical ML project fundamentals.', 'intermediate', 45, 70, 149],
  ['data-analytics-sql-bi-foundations', 'Data Analytics SQL and BI Foundations', 'data-ai-analytics', 'SQL, dashboards, metrics, data quality and business intelligence fundamentals.', 'novice', 40, 70, 99],
  ['python-backend-api-foundations', 'Python Backend API Foundations', 'software-engineering', 'Python APIs, HTTP, persistence, testing, error handling and production-readiness fundamentals.', 'intermediate', 45, 70, 149],
  ['javascript-react-foundations', 'JavaScript and React Foundations', 'software-engineering', 'Modern JavaScript, React components, state, accessibility and frontend engineering fundamentals.', 'intermediate', 45, 70, 149],
  ['nodejs-backend-foundations', 'Node.js Backend Foundations', 'software-engineering', 'Node.js APIs, async behavior, security, testing and deployment fundamentals.', 'intermediate', 45, 70, 149],
  ['cybersecurity-foundations', 'Cybersecurity Foundations', 'cybersecurity', 'Threats, identity, network security, secure behavior and incident response fundamentals.', 'novice', 40, 70, 99],
  ['cloud-security-foundations', 'Cloud Security Foundations', 'cybersecurity', 'IAM, encryption, network controls, logging and cloud security posture fundamentals.', 'intermediate', 45, 70, 149],
  ['business-analyst-digital-foundations', 'Business Analyst Digital Foundations', 'product-business-technology', 'Requirements, process mapping, stakeholder communication, acceptance criteria and digital delivery basics.', 'novice', 40, 70, 99],
  ['product-management-tech-foundations', 'Product Management Tech Foundations', 'product-business-technology', 'Discovery, prioritisation, metrics, roadmaps, delivery collaboration and product decision-making fundamentals.', 'novice', 40, 70, 99],
  ['sap-s4hana-sales-distribution-skills', 'SAP S/4HANA Sales and Distribution Skills', 'enterprise-applications', 'Independent assessment of order-to-cash, pricing, delivery, billing and sales master-data skills.', 'intermediate', 50, 70, 149],
  ['sap-abap-development-skills', 'SAP ABAP Development Skills', 'enterprise-applications', 'Independent assessment of ABAP language, data access, object-oriented design, debugging and clean-core extension skills.', 'intermediate', 60, 70, 199],
  ['oracle-cloud-supply-chain-foundations', 'Oracle Cloud Supply Chain Skills', 'enterprise-applications', 'Independent assessment of procurement, inventory, order management and supply-chain process skills.', 'intermediate', 50, 70, 149],
  ['servicenow-administration-foundations', 'ServiceNow Administration Skills', 'enterprise-applications', 'Independent assessment of platform configuration, users, workflows, service catalogues, reporting and operational controls.', 'novice', 45, 70, 149],
  ['docker-containerization-foundations', 'Docker Containerization Skills', 'cloud-devops', 'Images, containers, networking, storage, Compose, security and production container workflows.', 'novice', 45, 70, 99],
  ['terraform-infrastructure-as-code-foundations', 'Terraform Infrastructure as Code Skills', 'cloud-devops', 'Providers, state, modules, planning, lifecycle, security and collaborative infrastructure delivery.', 'intermediate', 55, 70, 149],
  ['aws-solutions-architecture-skills', 'AWS Solutions Architecture Skills', 'cloud-devops', 'Independent assessment of resilient AWS architecture, networking, security, data services and cost trade-offs.', 'advanced', 70, 72, 199],
  ['azure-administration-skills', 'Microsoft Azure Administration Skills', 'cloud-devops', 'Independent assessment of Azure identity, governance, compute, storage, networking and operational administration.', 'intermediate', 60, 70, 149],
  ['site-reliability-engineering-foundations', 'Site Reliability Engineering Foundations', 'cloud-devops', 'Service levels, observability, incident response, capacity, toil reduction and resilient operations.', 'intermediate', 55, 70, 149],
  ['python-data-analysis-skills', 'Python Data Analysis Skills', 'data-ai-analytics', 'Data preparation, pandas, numerical analysis, visualisation, validation and reproducible analytical workflows.', 'intermediate', 55, 70, 149],
  ['power-bi-data-analyst-skills', 'Power BI Data Analyst Skills', 'data-ai-analytics', 'Independent assessment of data modelling, Power Query, DAX, visual design, governance and insight delivery.', 'intermediate', 55, 70, 149],
  ['advanced-sql-analytics-skills', 'Advanced SQL Analytics Skills', 'data-ai-analytics', 'Joins, window functions, query design, performance, data quality and analytical problem solving.', 'advanced', 65, 72, 199],
  ['data-engineering-foundations', 'Data Engineering Foundations', 'data-ai-analytics', 'Batch and streaming pipelines, modelling, orchestration, quality, observability and platform fundamentals.', 'intermediate', 60, 70, 149],
  ['generative-ai-application-engineering', 'Generative AI Application Engineering', 'data-ai-analytics', 'LLM application design, grounding, tools, evaluation, safety, latency, cost and production operations.', 'advanced', 70, 72, 199],
  ['llm-rag-evaluation-foundations', 'LLM RAG and Evaluation Skills', 'data-ai-analytics', 'Retrieval, chunking, ranking, grounded generation, evaluation datasets, safety and monitoring.', 'advanced', 70, 72, 199],
  ['java-spring-boot-backend-skills', 'Java and Spring Boot Backend Skills', 'software-engineering', 'Java, Spring Boot APIs, persistence, testing, security, observability and production design.', 'intermediate', 60, 70, 149],
  ['csharp-dotnet-backend-skills', 'C# and .NET Backend Skills', 'software-engineering', 'C#, ASP.NET Core APIs, data access, testing, security, dependency injection and production operations.', 'intermediate', 60, 70, 149],
  ['typescript-application-development-skills', 'TypeScript Application Development Skills', 'software-engineering', 'Type modelling, narrowing, generics, application architecture, testing and reliable JavaScript integration.', 'intermediate', 55, 70, 149],
  ['react-application-engineering-skills', 'React Application Engineering Skills', 'software-engineering', 'Components, state, data flow, accessibility, performance, testing and frontend architecture.', 'intermediate', 55, 70, 149],
  ['api-design-microservices-foundations', 'API Design and Microservices Skills', 'software-engineering', 'HTTP contracts, boundaries, reliability, security, observability and distributed-system trade-offs.', 'advanced', 70, 72, 199],
  ['software-testing-qa-foundations', 'Software Testing and QA Skills', 'software-engineering', 'Test strategy, automation, exploratory testing, API/UI validation, defects and release confidence.', 'novice', 50, 70, 99],
  ['git-linux-developer-workflows', 'Git and Linux Developer Workflows', 'software-engineering', 'Version control, branching, command-line workflows, permissions, processes and delivery collaboration.', 'novice', 45, 70, 99],
  ['soc-analyst-foundations', 'SOC Analyst Foundations', 'cybersecurity', 'Alert triage, logs, threat context, investigation, escalation and security-operations workflows.', 'novice', 50, 70, 149],
  ['application-security-foundations', 'Application Security Skills', 'cybersecurity', 'Threat modelling, secure design, common vulnerabilities, testing, remediation and software-supply-chain controls.', 'intermediate', 60, 72, 199],
  ['identity-access-management-foundations', 'Identity and Access Management Skills', 'cybersecurity', 'Authentication, authorisation, federation, lifecycle controls, privileged access and auditability.', 'intermediate', 55, 70, 149],
  ['incident-response-threat-analysis', 'Incident Response and Threat Analysis Skills', 'cybersecurity', 'Preparation, investigation, containment, evidence handling, recovery and post-incident improvement.', 'advanced', 70, 72, 199],
  ['agile-scrum-delivery-foundations', 'Agile and Scrum Delivery Skills', 'product-business-technology', 'Goals, backlogs, facilitation, flow, feedback, metrics and practical delivery decisions.', 'novice', 45, 70, 99],
  ['technical-project-management-foundations', 'Technical Project Management Skills', 'product-business-technology', 'Scope, dependencies, risk, delivery planning, stakeholder decisions and technical programme execution.', 'intermediate', 55, 70, 149],
  ['it-support-service-desk-foundations', 'IT Support and Service Desk Skills', 'it-operations-support', 'Ticket triage, troubleshooting, customer communication, escalation, knowledge and service controls.', 'novice', 45, 70, 99],
  ['linux-system-administration-foundations', 'Linux System Administration Skills', 'it-operations-support', 'Users, permissions, processes, networking, storage, services, logging and operational troubleshooting.', 'intermediate', 55, 70, 149],
  ['networking-support-foundations', 'Networking Support Foundations', 'it-operations-support', 'Addressing, switching, routing, DNS, DHCP, wireless, diagnostics and secure network operations.', 'novice', 50, 70, 99],
];

const competencyTopics = {
  'enterprise-applications': ['Platform foundations', 'Master data', 'Business process flows', 'Configuration', 'Integration', 'Security and access', 'Reporting and controls', 'Troubleshooting'],
  'cloud-devops': ['Architecture foundations', 'Compute and containers', 'Storage and data', 'Networking', 'Identity and security', 'Infrastructure automation', 'Observability', 'Reliability and recovery', 'Cost and governance'],
  'data-ai-analytics': ['Data foundations', 'Preparation and quality', 'Analysis and modelling', 'Evaluation', 'Visualisation and communication', 'Architecture and pipelines', 'Responsible AI and security', 'Production monitoring'],
  'software-engineering': ['Language foundations', 'Application design', 'Data and persistence', 'APIs and integration', 'Testing and quality', 'Security', 'Performance', 'Delivery and operations', 'Troubleshooting'],
  cybersecurity: ['Security foundations', 'Identity and access', 'Network and endpoint defence', 'Application and cloud security', 'Detection and analysis', 'Incident response', 'Risk and governance', 'Operational troubleshooting'],
  'product-business-technology': ['Discovery and outcomes', 'Requirements and scope', 'Prioritisation', 'Delivery planning', 'Stakeholder communication', 'Metrics and analysis', 'Risk and governance', 'Continuous improvement'],
  'it-operations-support': ['Service foundations', 'Users and access', 'Devices and operating systems', 'Networking', 'Troubleshooting', 'Security and safety', 'Service communication', 'Monitoring and escalation'],
};

function topicSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function upsertCategory(client, [slug, name, description, icon, sortOrder], parentId = null) {
  const result = await client.query(`
    INSERT INTO categories (slug, name, description, icon, parent_id, kind, is_active, sort_order, meta_title, meta_description, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'skill', true, $6, $7, $8, now())
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      icon = EXCLUDED.icon,
      parent_id = EXCLUDED.parent_id,
      kind = EXCLUDED.kind,
      is_active = true,
      sort_order = EXCLUDED.sort_order,
      meta_title = EXCLUDED.meta_title,
      meta_description = EXCLUDED.meta_description,
      updated_at = now()
    RETURNING id
  `, [slug, name, description, icon, parentId, sortOrder, `${name} Certifications | Octamy`, description]);
  return result.rows[0].id;
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(5065497136023552::bigint)");
    const rootIdResult = await client.query(`SELECT id FROM categories WHERE slug = 'tech-certifications'`);
    let rootId = rootIdResult.rows[0]?.id;
    if (!rootId) {
      rootId = await upsertCategory(client, ['tech-certifications', 'Tech Certifications', 'Recruiter-relevant technology and digital-industry certification paths.', 'Code2', 1], null);
    }

    const categoryIds = new Map();
    for (const category of rootCategories) {
      categoryIds.set(category[0], await upsertCategory(client, category, rootId));
    }

    let courseCount = 0;
    let bankCount = 0;
    let protectedExistingCount = 0;
    for (const [slug, title, categorySlug, description, level, duration, passingScore, price] of assessments) {
      const categoryId = categoryIds.get(categorySlug);
      const existingCourse = await client.query(`
        SELECT id, owner_type, owner_id, product_type, assessment_purpose
        FROM courses
        WHERE slug = $1
        FOR UPDATE
      `, [slug]);
      if (existingCourse.rows[0]) {
        const existing = existingCourse.rows[0];
        if (existing.owner_type !== 'admin'
          || existing.owner_id !== null
          || existing.product_type !== 'assessment'
          || existing.assessment_purpose !== 'certification') {
          throw new Error(`CAREER_SHELL_OWNERSHIP_CONFLICT: ${slug} is not an admin certification assessment`);
        }
        protectedExistingCount += 1;
        continue;
      }
      const course = await client.query(`
        INSERT INTO courses (
          title, description, slug, category_id, duration, passing_score, price,
          product_type, level, is_active, is_internship, owner_type, owner_id,
          visibility, language, certification_mode, assessment_purpose, review_status,
          default_review_policy, subscription_eligible, reseller_eligible, use_blueprint_engine,
          meta_title, meta_description, featured_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, 'assessment', $8, false, false, 'admin', null,
          'private', 'en', 'octamy', 'certification', 'pending', 'immediate', false, false, true,
          $9, $10, null)
        RETURNING id
      `, [title, description, slug, categoryId, duration, passingScore, price.toFixed(2), level, `${title} | Octamy Certification`, description]);
      const courseId = course.rows[0].id;
      courseCount += 1;
      await client.query(`
        INSERT INTO course_categories (course_id, category_id, relation_type)
        VALUES ($1, $2, 'primary')
        ON CONFLICT (course_id, category_id) DO UPDATE SET relation_type = EXCLUDED.relation_type
      `, [courseId, categoryId]);

      const bankSlug = `${slug}-bank`;
      const existingBank = await client.query(`
        SELECT id FROM question_banks
        WHERE owner_type = 'admin' AND owner_id IS NULL AND slug = $1
        ORDER BY id ASC LIMIT 1
      `, [bankSlug]);
      if (existingBank.rows[0]) {
        throw new Error(`CAREER_BANK_ORPHAN_CONFLICT: ${bankSlug} exists without its catalog shell`);
      }
      const bank = await client.query(`
        INSERT INTO question_banks (
          slug, name, description, owner_type, owner_id, visibility, bank_purpose, bank_kind,
          status, subject, exam_family, syllabus_version, language, tags, question_count, updated_at
        )
        VALUES ($1, $2, $3, 'admin', null, 'private', 'certification', 'assessment_pool',
          'draft', $4, 'career-certification', '2026 v1', 'en', $5::json, 0, now())
        RETURNING id
      `, [bankSlug, `${title} Bank`, `Original Octamy starter bank for ${title}.`, title, JSON.stringify(['career-certification', categorySlug, slug])]);
      const bankId = bank.rows[0].id;
      bankCount += 1;

      for (const [topicIndex, topicName] of (competencyTopics[categorySlug] || []).entries()) {
        await client.query(`
          INSERT INTO question_topics (bank_id, name, slug, sort_order, updated_at)
          VALUES ($1, $2, $3, $4, now())
          ON CONFLICT (bank_id, slug) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, updated_at = now()
        `, [bankId, topicName, topicSlug(topicName), topicIndex + 1]);
      }

      // Intentionally do not create a generic blueprint. A versioned bank's
      // reviewed topic distribution must be approved through guarded services.
    }

    if (APPLY) {
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }
    console.log(JSON.stringify({
      mode: APPLY ? 'applied' : 'dry_run',
      operator: OPERATOR,
      categories: rootCategories.length,
      courses: courseCount,
      banks: bankCount,
      generatedQuestions: 0,
      protectedExistingShells: protectedExistingCount,
      releaseState: 'private-inactive-pending-without-blueprint',
    }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
