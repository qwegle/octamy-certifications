import { publicAssessmentPath } from "@shared/public-assessment-routes";

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
    origin?: "octamy" | "creator";
    creator?: { displayName: string; slug: string } | null;
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
    url: `${window.location.origin}/learn/${courseSlug}`,
    courseCode: courseSlug,
    provider: {
      "@type": "Organization",
      name: "Octamy",
      url: window.location.origin,
      logo: `${window.location.origin}/logo.png`
    },
    author: course.origin === "creator" && course.creator?.displayName ? {
      "@type": "Person",
      name: course.creator.displayName,
    } : {
      "@type": "Organization",
      name: "Octamy",
      url: window.location.origin,
    },
    instructor: course.instructorName ? {
      "@type": "Person",
      name: course.instructorName
    } : {
      "@type": "Organization", 
      name: "Octamy Expert Team"
    },
    educationalLevel: "Professional",
    coursePrerequisites: "Basic computer skills",
    timeRequired: `PT${course.duration}M`,
    offers: {
      "@type": "Offer",
      price: course.price,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: `${window.location.origin}/learn/${courseSlug}`,
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
      instructor: course.instructorName || "Octamy Expert Team"
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

  const assessmentUrl = `${window.location.origin}${publicAssessmentPath(courseSlug)}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Quiz",
    name: `${course.title} assessment`,
    description: course.description || `Take the ${course.title} assessment on Octamy.`,
    url: assessmentUrl,
    isAccessibleForFree: true,
    provider: {
      "@type": "Organization",
      name: "Octamy",
      url: window.location.origin,
      logo: `${window.location.origin}/logo.png`
    },
    author: course.origin === "creator" && course.creator?.displayName ? {
      "@type": "Person",
      name: course.creator.displayName,
    } : {
      "@type": "Organization",
      name: "Octamy",
      url: window.location.origin,
    },
    about: {
      "@type": "Course",
      name: course.title,
      courseCode: courseSlug
    },
    educationalLevel: "Professional",
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
      price: "0",
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: assessmentUrl,
      description: `The assessment attempt is free. The optional credential activation fee is ₹${course.price}.`,
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
