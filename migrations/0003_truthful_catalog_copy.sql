UPDATE "courses"
SET
  "description" = 'Assessment-based software development skill program covering full-stack concepts, code review practices, and agile delivery. Not employment or supervised work experience.',
  "is_internship" = true
WHERE "slug" = 'virtual-software-development-internship';

UPDATE "courses"
SET
  "description" = 'Assessment-based data science skill program covering data analysis, machine learning concepts, and reporting. Not employment or supervised work experience.',
  "is_internship" = true
WHERE "slug" = 'data-science-internship-program';
