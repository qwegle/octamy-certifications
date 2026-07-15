#!/usr/bin/env node
import 'dotenv/config';
import crypto from 'node:crypto';
import pg from 'pg';

const { Client } = pg;

const APPLY = process.argv.includes('--apply');
const CONFIRM = process.argv.includes('--confirm') && process.argv.includes('CAREER');
const OPERATOR = process.argv.includes('--operator')
  ? process.argv[process.argv.indexOf('--operator') + 1]
  : 'career-catalog-seed';

if (APPLY && !CONFIRM) {
  throw new Error('Use --apply --confirm CAREER to write career certification catalog changes');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const rootCategories = [
  ['enterprise-applications', 'Enterprise Applications', 'SAP, Oracle ERP, CRM, finance and enterprise workflow platforms.', 'BriefcaseBusiness', 60],
  ['cloud-devops', 'Cloud and DevOps', 'AWS, Azure, containers, CI/CD and reliability operations.', 'CloudCog', 30],
  ['data-ai-analytics', 'Data, AI and Analytics', 'Data analysis, applied AI, machine learning and generative AI.', 'BrainCircuit', 20],
  ['software-engineering', 'Software Engineering', 'Programming, APIs, testing and engineering fundamentals.', 'Code2', 10],
  ['cybersecurity', 'Cybersecurity', 'Security fundamentals, cloud security and operational risk awareness.', 'ShieldCheck', 40],
  ['product-business-technology', 'Product and Business Technology', 'Product, business analysis and digital operations skills.', 'BriefcaseBusiness', 50],
];

const assessments = [
  ['sap-s4hana-finance-foundations', 'SAP S/4HANA Finance Foundations', 'enterprise-applications', 'ERP finance processes, master data, postings and reporting fundamentals for SAP S/4HANA roles.', 'intermediate', 45, 70, 149],
  ['sap-mm-procurement-foundations', 'SAP MM Procurement Foundations', 'enterprise-applications', 'Procure-to-pay, purchasing documents, inventory movement and vendor process fundamentals.', 'intermediate', 45, 70, 149],
  ['oracle-erp-cloud-financials-foundations', 'Oracle ERP Cloud Financials Foundations', 'enterprise-applications', 'Oracle Cloud financials, ledgers, payables, receivables and close-process fundamentals.', 'intermediate', 45, 70, 149],
  ['salesforce-crm-admin-foundations', 'Salesforce CRM Admin Foundations', 'enterprise-applications', 'CRM objects, users, permissions, automation and reporting fundamentals for Salesforce admin roles.', 'novice', 40, 70, 99],
  ['aws-cloud-practitioner-foundations', 'AWS Cloud Practitioner Foundations', 'cloud-devops', 'AWS core services, billing, security, networking and cloud operating model fundamentals.', 'novice', 40, 70, 99],
  ['azure-fundamentals-az-900-readiness', 'Microsoft Azure Fundamentals Readiness', 'cloud-devops', 'Azure compute, storage, identity, networking, pricing and governance fundamentals.', 'novice', 40, 70, 99],
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
];

function questionTemplates(title, slug) {
  const domain = title.replace(/ Foundations| Readiness| for Work/g, '');
  return [
    [`Which outcome best shows practical readiness in ${domain}?`, ['Memorising vendor slogans', 'Applying core concepts to a realistic work scenario', 'Skipping security and governance review', 'Using only undocumented shortcuts'], 1, 'easy'],
    [`A team is adopting ${domain}. What should be validated first?`, ['The business goal and operating constraints', 'Only the visual branding', 'The longest possible tool list', 'A random implementation copied without context'], 0, 'easy'],
    [`Which risk is most common when teams implement ${domain} without governance?`, ['Clear accountability', 'Better documentation', 'Misconfiguration, poor controls or inconsistent process', 'Improved auditability by default'], 2, 'medium'],
    [`What makes an assessment answer job-relevant for ${domain}?`, ['It connects a concept to an operational decision', 'It repeats a definition only', 'It avoids trade-offs', 'It ignores user or business impact'], 0, 'medium'],
    [`When troubleshooting a ${domain} workflow, what is the strongest first step?`, ['Change multiple variables at once', 'Define the expected state and inspect evidence', 'Delete the environment immediately', 'Assume the user is wrong'], 1, 'medium'],
    [`Which practice improves enterprise adoption of ${domain}?`, ['Role-based access and documented ownership', 'Shared admin passwords', 'No change history', 'Unreviewed production changes'], 0, 'medium'],
    [`A candidate claims ${domain} experience. Which signal is strongest?`, ['A verified scenario-based score with answer evidence', 'Only a generic résumé keyword', 'A copied certificate image', 'A social media post'], 0, 'easy'],
    [`Which metric is usually most useful after deploying ${domain} changes?`, ['A vanity count unrelated to users', 'Operational outcome tied to the original goal', 'Number of meetings held', 'Tool popularity ranking'], 1, 'medium'],
    [`What should be documented before scaling ${domain}?`, ['Decision rationale, ownership, controls and rollback path', 'Only the launch date', 'Nothing if it works once', 'A private note no team can access'], 0, 'hard'],
    [`Why should Octamy separate practice exams from ${domain} certifications?`, ['To avoid confusing preparation with recruiter-visible evidence', 'To hide results from learners', 'To remove answer review', 'To make all exams offline'], 0, 'easy'],
  ].map(([question, options, correctAnswer, difficulty], index) => ({
    question,
    options,
    correctAnswer,
    difficulty,
    explanation: `This checks whether the learner can apply ${domain} knowledge in a practical workplace context.`,
    tags: [slug, 'career-certification', domain.toLowerCase().replace(/[^a-z0-9]+/g, '-')],
    index,
  }));
}

function hashQuestion(bankSlug, question) {
  return crypto.createHash('sha256').update(`${bankSlug}:${question}`).digest('hex');
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
    let questionCount = 0;
    for (const [slug, title, categorySlug, description, level, duration, passingScore, price] of assessments) {
      const categoryId = categoryIds.get(categorySlug);
      const course = await client.query(`
        INSERT INTO courses (
          title, description, slug, category_id, duration, passing_score, price,
          product_type, level, is_active, is_internship, owner_type, owner_id,
          visibility, language, certification_mode, assessment_purpose, review_status,
          default_review_policy, subscription_eligible, reseller_eligible, use_blueprint_engine,
          meta_title, meta_description, featured_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, 'assessment', $8, true, false, 'admin', null,
          'public', 'en', 'octamy', 'certification', 'approved', 'immediate', false, true, true,
          $9, $10, now())
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          category_id = EXCLUDED.category_id,
          duration = EXCLUDED.duration,
          passing_score = EXCLUDED.passing_score,
          price = EXCLUDED.price,
          product_type = 'assessment',
          level = EXCLUDED.level,
          is_active = true,
          owner_type = 'admin',
          owner_id = null,
          visibility = 'public',
          certification_mode = 'octamy',
          assessment_purpose = 'certification',
          review_status = 'approved',
          default_review_policy = 'immediate',
          subscription_eligible = false,
          reseller_eligible = true,
          use_blueprint_engine = true,
          meta_title = EXCLUDED.meta_title,
          meta_description = EXCLUDED.meta_description,
          featured_at = COALESCE(courses.featured_at, now())
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
      const bank = existingBank.rows[0]
        ? await client.query(`
          UPDATE question_banks SET
            name = $2, description = $3, visibility = 'private', bank_purpose = 'certification',
            bank_kind = 'assessment_pool', status = 'active', subject = $4,
            exam_family = 'career-certification', syllabus_version = '2026 v1', language = 'en',
            tags = $5::json, updated_at = now()
          WHERE id = $1 RETURNING id
        `, [existingBank.rows[0].id, `${title} Bank`, `Original Octamy starter bank for ${title}.`, title, JSON.stringify(['career-certification', categorySlug, slug])])
        : await client.query(`
        INSERT INTO question_banks (
          slug, name, description, owner_type, owner_id, visibility, bank_purpose, bank_kind,
          status, subject, exam_family, syllabus_version, language, tags, question_count, updated_at
        )
        VALUES ($1, $2, $3, 'admin', null, 'private', 'certification', 'assessment_pool',
          'active', $4, 'career-certification', '2026 v1', 'en', $5::json, 0, now())
        RETURNING id
      `, [bankSlug, `${title} Bank`, `Original Octamy starter bank for ${title}.`, title, JSON.stringify(['career-certification', categorySlug, slug])]);
      const bankId = bank.rows[0].id;
      bankCount += 1;

      const templates = questionTemplates(title, slug);
      for (const item of templates) {
        await client.query(`
          INSERT INTO questions (
            course_id, bank_id, question, options, correct_answer, is_active, question_type,
            max_points, difficulty, question_format, negative_marks, tags, explanation,
            content_hash, review_status, generation_source, reviewed_at, version
          )
          VALUES (null, $1, $2, $3::json, $4, true, 'multiple_choice',
            100, $5, 'mcq_single', 0, $6::json, $7, $8, 'approved', 'human', now(), 1)
          ON CONFLICT (bank_id, content_hash) WHERE bank_id IS NOT NULL AND content_hash IS NOT NULL
          DO UPDATE SET
            options = EXCLUDED.options,
            correct_answer = EXCLUDED.correct_answer,
            is_active = true,
            difficulty = EXCLUDED.difficulty,
            tags = EXCLUDED.tags,
            explanation = EXCLUDED.explanation,
            review_status = 'approved',
            updated_at = now()
        `, [bankId, item.question, JSON.stringify(item.options), item.correctAnswer, item.difficulty, JSON.stringify(item.tags), item.explanation, hashQuestion(bankSlug, item.question)]);
        questionCount += 1;
      }

      await client.query(`UPDATE question_banks SET question_count = (SELECT count(*) FROM questions WHERE bank_id = $1 AND is_active = true AND review_status = 'approved'), updated_at = now() WHERE id = $1`, [bankId]);
      await client.query(`DELETE FROM course_question_blueprint WHERE course_id = $1`, [courseId]);
      await client.query(`
        INSERT INTO course_question_blueprint (course_id, bank_id, topic_id, question_count, difficulty, marks_per_question, negative_marks, sort_order)
        VALUES ($1, $2, null, 10, 'mixed', 1, 0, 1)
      `, [courseId, bankId]);
    }

    if (APPLY) {
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }
    console.log(JSON.stringify({ mode: APPLY ? 'applied' : 'dry_run', operator: OPERATOR, categories: rootCategories.length, courses: courseCount, banks: bankCount, questions: questionCount }, null, 2));
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
