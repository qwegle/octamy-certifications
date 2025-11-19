interface StructuredDataProps {
  course: {
    id: number;
    title: string;
    description?: string;
    slug?: string;
    price: string;
    duration: number;
    instructorName?: string;
    category?: { name: string };
  };
  rating?: {
    averageRating: string;
    totalReviews: number;
    rating1Count: number;
    rating2Count: number;
    rating3Count: number;
    rating4Count: number;
    rating5Count: number;
  };
}

export function CourseStructuredData({ course, rating }: StructuredDataProps) {
  const courseSlug = course.slug || course.title.toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '-');

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.description || `Learn ${course.title} with our comprehensive certification course`,
    url: `${window.location.origin}/course/${courseSlug}`,
    courseCode: courseSlug,
    provider: {
      "@type": "Organization",
      name: "PremCQ",
      url: window.location.origin,
      logo: `${window.location.origin}/logo.png`
    },
    instructor: course.instructorName ? {
      "@type": "Person",
      name: course.instructorName
    } : {
      "@type": "Organization", 
      name: "PremCQ Expert Team"
    },
    educationalLevel: "Professional",
    coursePrerequisites: "Basic computer skills",
    timeRequired: `PT${course.duration}M`,
    offers: {
      "@type": "Offer",
      price: course.price,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: `${window.location.origin}/exam/${courseSlug}`,
      category: course.category?.name || "Professional Development"
    },
    aggregateRating: rating && rating.totalReviews > 0 ? {
      "@type": "AggregateRating",
      ratingValue: rating.averageRating,
      reviewCount: rating.totalReviews,
      bestRating: "5",
      worstRating: "1"
    } : undefined,
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: `PT${course.duration}M`,
      instructor: course.instructorName || "PremCQ Expert Team"
    }
  };

  // Remove undefined fields
  const cleanedData = JSON.parse(JSON.stringify(structuredData));

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(cleanedData, null, 2) }}
    />
  );
}

export function ExamStructuredData({ course, rating }: StructuredDataProps) {
  const courseSlug = course.slug || course.title.toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '-');

  const structuredData = {
    "@context": "https://schema.org",
    "@type": ["Quiz", "EducationalOccupationalCredential"],
    name: `${course.title} - Certification Exam`,
    description: `Take the ${course.title} certification exam and earn your professional credential`,
    url: `${window.location.origin}/exam/${courseSlug}`,
    provider: {
      "@type": "Organization",
      name: "PremCQ",
      url: window.location.origin,
      logo: `${window.location.origin}/logo.png`
    },
    about: {
      "@type": "Course",
      name: course.title,
      courseCode: courseSlug
    },
    educationalLevel: "Professional",
    credentialCategory: "Certificate",
    competencyRequired: course.description || `Proficiency in ${course.title}`,
    aggregateRating: rating && rating.totalReviews > 0 ? {
      "@type": "AggregateRating", 
      ratingValue: rating.averageRating,
      reviewCount: rating.totalReviews,
      bestRating: "5",
      worstRating: "1"
    } : undefined,
    offers: {
      "@type": "Offer",
      price: course.price,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock"
    }
  };

  const cleanedData = JSON.parse(JSON.stringify(structuredData));

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(cleanedData, null, 2) }}
    />
  );
}