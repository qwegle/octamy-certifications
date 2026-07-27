import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Banner, Button, ErrorState, Heading, Input, Screen, Skeleton, Text } from '@/components/ui';
import { useSession } from '@/features/auth';
import { getLearnerProfile, updateLearnerProfile, type ProfileUpdate } from '@/features/profile';
import { asApiError } from '@/lib/api-client';
import { useFeedback } from '@/lib/feedback';
import { queryKeys } from '@/lib/query-keys';
import { spacing, useAppTheme } from '@/theme';

interface FormState {
  bio: string;
  careerGoals: string;
  company: string;
  currentRole: string;
  experience: string;
  linkedinProfile: string;
  location: string;
  name: string;
  phone: string;
  portfolioUrl: string;
  skills: string;
}

type FormErrors = Partial<Record<keyof FormState | '_form', string>>;

const emptyForm: FormState = {
  bio: '', careerGoals: '', company: '', currentRole: '', experience: '', linkedinProfile: '',
  location: '', name: '', phone: '', portfolioUrl: '', skills: '',
};

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (form.name.trim().length < 2) errors.name = 'Enter at least 2 characters.';
  if (form.experience.trim()) {
    const years = Number(form.experience);
    if (!Number.isFinite(years) || years < 0 || years > 50) errors.experience = 'Enter a number from 0 to 50.';
  }
  for (const field of ['linkedinProfile', 'portfolioUrl'] as const) {
    const value = form[field].trim();
    if (value && !/^https?:\/\/\S+$/i.test(value)) errors[field] = 'Enter a complete http:// or https:// URL.';
  }
  return errors;
}

export default function EditProfileScreen() {
  const queryClient = useQueryClient();
  const { colors } = useAppTheme();
  const { canMutate, refreshSession } = useSession();
  const { showToast } = useFeedback();
  const initialized = useRef(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});

  const profileQuery = useQuery({ queryKey: queryKeys.profile.detail, queryFn: getLearnerProfile });
  useEffect(() => {
    if (!profileQuery.data || initialized.current) return;
    const profile = profileQuery.data;
    setForm({
      bio: profile.bio,
      careerGoals: profile.careerGoals,
      company: profile.company,
      currentRole: profile.currentRole,
      experience: profile.experience === null ? '' : String(profile.experience),
      linkedinProfile: profile.linkedinProfile,
      location: profile.location,
      name: profile.name,
      phone: profile.phone,
      portfolioUrl: profile.portfolioUrl,
      skills: profile.skills.join(', '),
    });
    initialized.current = true;
  }, [profileQuery.data]);

  const mutation = useMutation({
    mutationFn: updateLearnerProfile,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile.all });
      await refreshSession().catch(() => undefined);
      showToast({ title: 'Profile updated', message: 'Your changes were confirmed by Octamy.', tone: 'success' });
      router.back();
    },
    onError: (error) => {
      const apiError = asApiError(error);
      const serverErrors: FormErrors = { _form: apiError.message };
      for (const [field, messages] of Object.entries(apiError.fieldErrors ?? {})) {
        if (field in form && messages[0]) serverErrors[field as keyof FormState] = messages[0];
      }
      setErrors(serverErrors);
    },
  });

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field] || errors._form) setErrors((current) => ({ ...current, [field]: undefined, _form: undefined }));
  };

  const save = () => {
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || mutation.isPending || !canMutate) return;
    const update: ProfileUpdate = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      company: form.company.trim(),
      currentRole: form.currentRole.trim(),
      location: form.location.trim(),
      ...(form.experience.trim() ? { experience: Number(form.experience) } : {}),
      skills: [...new Set(form.skills.split(',').map((skill) => skill.trim()).filter(Boolean))],
      linkedinProfile: form.linkedinProfile.trim(),
      portfolioUrl: form.portfolioUrl.trim(),
      bio: form.bio.trim(),
      careerGoals: form.careerGoals.trim(),
    };
    mutation.mutate(update);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Edit profile' }} />
      <Screen>
        <View style={styles.heading}>
          <Heading>Edit profile</Heading>
          <Text muted>These profile details are stored by Octamy. Recruiter visibility remains off unless you enable it separately in Privacy & evidence.</Text>
        </View>

        {!canMutate ? <Banner title="Editing unavailable" message="Reconnect and validate your session before changing server profile data." tone="warning" /> : null}

        {profileQuery.isPending ? (
          <View accessibilityLabel="Loading profile form" accessibilityRole="progressbar" style={styles.form}>
            <Skeleton height={72} /><Skeleton height={72} /><Skeleton height={72} /><Skeleton height={120} />
          </View>
        ) : profileQuery.isError ? (
          <ErrorState title="Profile unavailable" onRetry={() => void profileQuery.refetch()} />
        ) : (
          <View style={styles.form}>
            <Input autoCapitalize="words" error={errors.name} label="Full name" onChangeText={(value) => updateField('name', value)} value={form.name} />
            <Input autoComplete="tel" error={errors.phone} keyboardType="phone-pad" label="Phone (optional)" onChangeText={(value) => updateField('phone', value)} value={form.phone} />
            <Input autoCapitalize="words" error={errors.currentRole} label="Current role (optional)" onChangeText={(value) => updateField('currentRole', value)} value={form.currentRole} />
            <Input autoCapitalize="words" error={errors.company} label="Company (optional)" onChangeText={(value) => updateField('company', value)} value={form.company} />
            <Input autoCapitalize="words" error={errors.location} label="Location (optional)" onChangeText={(value) => updateField('location', value)} value={form.location} />
            <Input error={errors.experience} keyboardType="decimal-pad" label="Years of experience (optional)" onChangeText={(value) => updateField('experience', value)} value={form.experience} />
            <Input error={errors.skills} hint="Separate skills with commas." label="Skills (optional)" onChangeText={(value) => updateField('skills', value)} value={form.skills} />
            <Input autoCapitalize="none" autoCorrect={false} error={errors.linkedinProfile} keyboardType="url" label="LinkedIn URL (optional)" onChangeText={(value) => updateField('linkedinProfile', value)} value={form.linkedinProfile} />
            <Input autoCapitalize="none" autoCorrect={false} error={errors.portfolioUrl} keyboardType="url" label="Portfolio URL (optional)" onChangeText={(value) => updateField('portfolioUrl', value)} value={form.portfolioUrl} />
            <Input error={errors.bio} label="Professional bio (optional)" multiline onChangeText={(value) => updateField('bio', value)} style={styles.multiline} textAlignVertical="top" value={form.bio} />
            <Input error={errors.careerGoals} label="Career goals (optional)" multiline onChangeText={(value) => updateField('careerGoals', value)} style={styles.multiline} textAlignVertical="top" value={form.careerGoals} />
            {errors._form ? <Text accessibilityLiveRegion="assertive" style={{ color: colors.destructive }}>{errors._form}</Text> : null}
            <Button disabled={!canMutate} label={mutation.isPending ? 'Saving…' : 'Save profile'} loading={mutation.isPending} onPress={save} />
            <Button disabled={mutation.isPending} label="Cancel" onPress={() => router.back()} variant="ghost" />
          </View>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  heading: { gap: spacing.sm },
  multiline: { minHeight: 112 },
});
