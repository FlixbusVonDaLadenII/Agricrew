import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform, Switch, Modal, FlatList } from 'react-native';
import { getThemeColors, Theme } from '@/theme/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

const currentTheme: Theme = 'dark';
const themeColors = getThemeColors(currentTheme);
const baseFontFamily = Platform.select({ ios: 'System', android: 'Roboto', default: 'System' });

const DRIVING_LICENSES = ['B', 'BE', 'C', 'CE', 'C1', 'C1E', 'T', 'L'];
const HEADER_HEIGHT = 100;

export default function AddJobScreen() {
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();

    const jobTypesOptions = t('jobTypes', { returnObjects: true }) as Record<string, string>;
    const jobTypeKeys = Object.keys(jobTypesOptions);
    const translatedCountries = t('filters.countries', { returnObjects: true }) as Record<string, string>;
    const countryKeys = Object.keys(translatedCountries);

    const [session, setSession] = useState<Session | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [country, setCountry] = useState<string>(countryKeys[0] || '');
    const [region, setRegion] = useState<string>('');
    const [salaryPerHour, setSalaryPerHour] = useState('');
    const [selectedLicenses, setSelectedLicenses] = useState<string[]>([]);
    const [jobTypes, setJobTypes] = useState<string[]>([]);
    const [isActive, setIsActive] = useState(true);

    const [countryPickerVisible, setCountryPickerVisible] = useState(false);
    const [regionPickerVisible, setRegionPickerVisible] = useState(false);
    const [tempCountry, setTempCountry] = useState<string>(country);
    const [tempRegion, setTempRegion] = useState<string>(region);
    const [countrySearch, setCountrySearch] = useState('');
    const [regionSearch, setRegionSearch] = useState('');
    const [isTitleFocused, setIsTitleFocused] = useState(false);
    const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);
    const [isLocationFocused, setIsLocationFocused] = useState(false);
    const [isSalaryFocused, setIsSalaryFocused] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (session?.user) {
            setLoadingUser(true);
            supabase.from('profiles').select('role').eq('id', session.user.id).single().then(({ data: profile, error }) => {
                if (error) { console.error('Error fetching user role:', error); setUserRole(null); }
                else if (profile) { setUserRole(profile.role); }
                setLoadingUser(false);
            });
        } else {
            setUserRole(null);
            setLoadingUser(false);
        }
    }, [session]);

    useEffect(() => { setTempCountry(country); }, [country, countryPickerVisible]);
    useEffect(() => { setTempRegion(region); }, [region, regionPickerVisible]);
    useEffect(() => {
        if (!country) return;
        const regionsForCountry = t(`filters.regions.${country}`, { returnObjects: true }) as Record<string, string>;
        const regionKeys = Object.keys(regionsForCountry);
        if (regionKeys.length > 0 && !regionKeys.includes(region)) {
            setRegion(regionKeys[0]);
        } else if (regionKeys.length === 0) {
            setRegion('');
        }
    }, [country, t, region]);

    const toggleLicense = (license: string) => { setSelectedLicenses(prev => prev.includes(license) ? prev.filter(l => l !== license) : [...prev, license]); };
    const toggleJobType = (typeKey: string) => { setJobTypes(prev => prev.includes(typeKey) ? prev.filter(t => t !== typeKey) : [...prev, typeKey]); };

    const handleAddJob = async () => {
        if (userRole !== 'Betrieb') { Alert.alert('Permission Denied', t('addJob.permissionDenied')); return; }
        if (!title || !description || !location || !country || !region) { Alert.alert(t('addJob.alertMissingFields'), t('addJob.alertMissingFieldsMessage')); return; }
        setSubmitting(true);
        const salary = salaryPerHour ? parseFloat(salaryPerHour) : null;
        if (salaryPerHour && isNaN(salary!)) { Alert.alert(t('addJob.alertInvalidSalary'), t('addJob.alertInvalidSalaryMessage')); setSubmitting(false); return; }

        const { error } = await supabase.from('jobs').insert({
            title, description, location,
            country: country,
            region: region,
            salary_per_hour: salary,
            required_licenses: selectedLicenses,
            job_type: jobTypes,
            is_active: isActive,
            farm_id: session!.user.id,
        });
        setSubmitting(false);
        if (error) {
            Alert.alert('Submission Failed', error.message || 'Could not add job.');
        } else {
            Alert.alert(t('addJob.alertSuccess'), t('addJob.alertSuccessMessage'));
            setTitle(''); setDescription(''); setLocation('');
            setCountry(countryKeys[0]); setRegion(''); setSalaryPerHour('');
            setSelectedLicenses([]); setJobTypes([]); setIsActive(true);
            router.replace('/(tabs)');
        }
    };

    const handleCountrySelectionDone = () => { setCountry(tempCountry); setCountryPickerVisible(false); setCountrySearch(''); };
    const handleCountrySelectionCancel = () => { setTempCountry(country); setCountryPickerVisible(false); setCountrySearch(''); };
    const handleRegionSelectionDone = () => { setRegion(tempRegion); setRegionPickerVisible(false); setRegionSearch(''); };
    const handleRegionSelectionCancel = () => { setTempRegion(region); setRegionPickerVisible(false); setRegionSearch(''); };

    const totalFixedHeaderHeight = insets.top + HEADER_HEIGHT;
    const availableRegions = country ? t(`filters.regions.${country}`, { returnObjects: true }) as Record<string, string> : {};
    const filteredCountries = countryKeys.filter(c => translatedCountries[c].toLowerCase().includes(countrySearch.toLowerCase()));
    const filteredRegions = Object.keys(availableRegions).filter(r => availableRegions[r].toLowerCase().includes(regionSearch.toLowerCase()));

    const renderPickerItem = ({ item, isCountryPicker, tempValue, setTempValue }: { item: string; isCountryPicker: boolean; tempValue: string; setTempValue: (val: string) => void; }) => (
        <TouchableOpacity style={[styles.listItem, item === tempValue && styles.selectedListItem]} onPress={() => setTempValue(item)}>
            <Text style={styles.listItemText}>{isCountryPicker ? translatedCountries[item] : availableRegions[item]}</Text>
            {item === tempValue && <MaterialCommunityIcons name="check" size={20} color={themeColors.primary} />}
        </TouchableOpacity>
    );

    if (loadingUser) { return <View style={styles.centeredContainer}><ActivityIndicator size="large" color={themeColors.primary} /></View>; }
    if (userRole !== 'Betrieb') {
        return (
            <View style={styles.container}>
                <View style={[styles.fixedTopSpacer, { height: insets.top, backgroundColor: themeColors.background }]} />
                <View style={[styles.header, { top: insets.top }]}><Text style={styles.pageTitle}>{t('addJob.pageTitle')}</Text></View>
                <View style={[styles.permissionDeniedContainer, { paddingTop: totalFixedHeaderHeight }]}>
                    <MaterialCommunityIcons name="lock-alert-outline" size={80} color={themeColors.textSecondary} />
                    <Text style={styles.permissionDeniedText}>{t('addJob.permissionDenied')}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={[styles.fixedTopSpacer, { height: insets.top, backgroundColor: themeColors.background }]} />
            <View style={[styles.header, { top: insets.top }]}><Text style={styles.pageTitle}>{t('addJob.pageTitle')}</Text></View>
            <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: totalFixedHeaderHeight }]} keyboardShouldPersistTaps="handled">
                <View style={styles.formCard}>
                    <View style={styles.formSection}>
                        <Text style={styles.sectionTitle}>{t('addJob.sectionJobDetails')}</Text>
                        <Text style={styles.label}>{t('addJob.labelJobTitle')} <Text style={styles.requiredIndicator}>*</Text></Text>
                        <TextInput style={[styles.input, isTitleFocused && styles.inputFocused]} placeholder={t('addJob.placeholderJobTitle')} placeholderTextColor={themeColors.textHint} value={title} onChangeText={setTitle} onFocus={() => setIsTitleFocused(true)} onBlur={() => setIsTitleFocused(false)} />
                        <Text style={styles.label}>{t('addJob.labelDescription')} <Text style={styles.requiredIndicator}>*</Text></Text>
                        <TextInput style={[styles.input, styles.textArea, isDescriptionFocused && styles.inputFocused]} placeholder={t('addJob.placeholderDescription')} placeholderTextColor={themeColors.textHint} multiline value={description} onChangeText={setDescription} onFocus={() => setIsDescriptionFocused(true)} onBlur={() => setIsDescriptionFocused(false)} />
                    </View>
                    <View style={styles.formSection}>
                        <Text style={styles.sectionTitle}>{t('addJob.sectionLocation')}</Text>
                        <Text style={styles.label}>{t('addJob.labelCountry')} <Text style={styles.requiredIndicator}>*</Text></Text>
                        <TouchableOpacity style={styles.modalPickerButton} onPress={() => setCountryPickerVisible(true)}><Text style={styles.modalPickerButtonText}>{translatedCountries[country] || t('addJob.selectCountry')}</Text><MaterialCommunityIcons name="chevron-down" size={24} color={themeColors.textSecondary} /></TouchableOpacity>
                        <Text style={styles.label}>{t('addJob.labelRegion')} <Text style={styles.requiredIndicator}>*</Text></Text>
                        <TouchableOpacity style={[styles.modalPickerButton, !Object.keys(availableRegions).length && styles.modalPickerButtonDisabled]} onPress={() => Object.keys(availableRegions).length && setRegionPickerVisible(true)} disabled={!Object.keys(availableRegions).length}><Text style={[styles.modalPickerButtonText, !Object.keys(availableRegions).length && styles.modalPickerButtonTextDisabled]}>{availableRegions[region] || t('addJob.selectRegion')}</Text><MaterialCommunityIcons name="chevron-down" size={24} color={!Object.keys(availableRegions).length ? themeColors.textHint : themeColors.textSecondary} /></TouchableOpacity>
                        <Text style={styles.label}>{t('addJob.labelExactLocation')} <Text style={styles.requiredIndicator}>*</Text></Text>
                        <TextInput style={[styles.input, isLocationFocused && styles.inputFocused]} placeholder={t('addJob.placeholderExactLocation')} placeholderTextColor={themeColors.textHint} value={location} onChangeText={setLocation} onFocus={() => setIsLocationFocused(true)} onBlur={() => setIsLocationFocused(false)} />
                    </View>
                    <View style={styles.formSection}>
                        <Text style={styles.sectionTitle}>{t('addJob.sectionCompensation')}</Text>
                        <Text style={styles.label}>{t('addJob.labelSalary')}</Text>
                        <TextInput style={[styles.input, isSalaryFocused && styles.inputFocused]} placeholder={t('addJob.placeholderSalary')} placeholderTextColor={themeColors.textHint} keyboardType="numeric" value={salaryPerHour} onChangeText={setSalaryPerHour} onFocus={() => setIsSalaryFocused(true)} onBlur={() => setIsSalaryFocused(false)} />
                        <Text style={styles.label}>{t('addJob.labelJobType')}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jobTypeScrollContainer}>{jobTypeKeys.map(key => { const isSelected = jobTypes.includes(key); return ( <TouchableOpacity key={key} style={[styles.jobTypeButton, isSelected && styles.jobTypeButtonSelected]} onPress={() => toggleJobType(key)}><Text style={[styles.jobTypeText, isSelected && styles.jobTypeTextSelected]}>{jobTypesOptions[key]}</Text></TouchableOpacity> );})}</ScrollView>
                    </View>
                    <View style={styles.formSection}>
                        <Text style={styles.sectionTitle}>{t('addJob.sectionRequirements')}</Text>
                        <Text style={styles.label}>{t('addJob.labelLicenses')}</Text>
                        <View style={styles.licensesContainer}>{DRIVING_LICENSES.map(license => (<TouchableOpacity key={license} style={[styles.licenseCheckbox, selectedLicenses.includes(license) && styles.licenseCheckboxSelected]} onPress={() => toggleLicense(license)}><Text style={[styles.licenseText, selectedLicenses.includes(license) && styles.licenseTextSelected]}>{license}</Text></TouchableOpacity>))}</View>
                    </View>
                    <View>
                        <Text style={styles.sectionTitle}>{t('addJob.sectionStatus')}</Text>
                        <View style={styles.toggleRow}><Text style={styles.label}>{t('addJob.labelActive')}</Text><Switch trackColor={{ false: themeColors.textSecondary, true: themeColors.primaryLight }} thumbColor={isActive ? themeColors.primary : themeColors.surfaceHighlight} onValueChange={setIsActive} value={isActive} /></View>
                    </View>
                    <TouchableOpacity style={styles.submitButton} onPress={handleAddJob} disabled={submitting}>{submitting ? <ActivityIndicator color={themeColors.text} /> : <Text style={styles.submitButtonText}>{t('addJob.buttonPublish')}</Text>}</TouchableOpacity>
                </View>
            </ScrollView>

            <Modal animationType="slide" transparent={true} visible={countryPickerVisible} onRequestClose={handleCountrySelectionCancel}><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>{t('addJob.modalSelectCountry')}</Text><TextInput style={styles.modalSearchInput} placeholder={t('addJob.modalSearchPlaceholder')} value={countrySearch} onChangeText={setCountrySearch} placeholderTextColor={themeColors.textHint} /><FlatList data={filteredCountries} keyExtractor={item => item} renderItem={({ item }) => renderPickerItem({ item, isCountryPicker: true, tempValue: tempCountry, setTempValue: setTempCountry })} ListEmptyComponent={<Text style={styles.emptyListText}>{t('addJob.modalNoResults')}</Text>} style={styles.listContainer} /><View style={styles.modalButtonContainer}><TouchableOpacity style={[styles.modalActionButton, styles.modalCancelButton]} onPress={handleCountrySelectionCancel}><Text style={styles.modalCancelButtonText}>{t('addJob.modalCancel')}</Text></TouchableOpacity><TouchableOpacity style={[styles.modalActionButton, styles.modalDoneButton]} onPress={handleCountrySelectionDone}><Text style={styles.modalDoneButtonText}>{t('addJob.modalDone')}</Text></TouchableOpacity></View></View></View></Modal>
            <Modal animationType="slide" transparent={true} visible={regionPickerVisible} onRequestClose={handleRegionSelectionCancel}><View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>{t('addJob.modalSelectRegion')}</Text><TextInput style={styles.modalSearchInput} placeholder={t('addJob.modalSearchPlaceholder')} value={regionSearch} onChangeText={setRegionSearch} placeholderTextColor={themeColors.textHint} /><FlatList data={filteredRegions} keyExtractor={item => item} renderItem={({ item }) => renderPickerItem({ item, isCountryPicker: false, tempValue: tempRegion, setTempValue: setTempRegion })} ListEmptyComponent={<Text style={styles.emptyListText}>{t('addJob.modalNoResults')}</Text>} style={styles.listContainer} /><View style={styles.modalButtonContainer}><TouchableOpacity style={[styles.modalActionButton, styles.modalCancelButton]} onPress={handleRegionSelectionCancel}><Text style={styles.modalCancelButtonText}>{t('addJob.modalCancel')}</Text></TouchableOpacity><TouchableOpacity style={[styles.modalActionButton, styles.modalDoneButton]} onPress={handleRegionSelectionDone}><Text style={styles.modalDoneButtonText}>{t('addJob.modalDone')}</Text></TouchableOpacity></View></View></View></Modal>
        </View>
    );
}

const SPACING = { xsmall: 4, small: 8, medium: 16, large: 24, xlarge: 32 };
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: themeColors.background },
    fixedTopSpacer: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 12, backgroundColor: themeColors.background },
    header: { position: 'absolute', left: 0, right: 0, height: HEADER_HEIGHT, paddingHorizontal: SPACING.large, backgroundColor: themeColors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border, justifyContent: 'center', zIndex: 11 },
    pageTitle: { fontFamily: baseFontFamily, fontSize: 34, fontWeight: 'bold', color: themeColors.text },
    centeredContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: themeColors.background },
    permissionDeniedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACING.large },
    permissionDeniedText: { fontFamily: baseFontFamily, fontSize: 18, color: themeColors.textSecondary, textAlign: 'center', marginTop: SPACING.medium },
    scrollContent: { flexGrow: 1, paddingHorizontal: SPACING.medium, paddingBottom: SPACING.xlarge, backgroundColor: themeColors.background },
    formCard: { width: '100%', maxWidth: 500, alignSelf: 'center', backgroundColor: themeColors.surface, borderRadius: 15, padding: SPACING.large, marginTop: SPACING.medium, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 10 },
    formSection: { marginBottom: SPACING.large },
    sectionTitle: { fontFamily: baseFontFamily, fontSize: 20, fontWeight: 'bold', color: themeColors.text, marginBottom: SPACING.medium, paddingBottom: SPACING.small, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border },
    label: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text, marginBottom: SPACING.small, fontWeight: '600' },
    requiredIndicator: { color: themeColors.primary, fontWeight: 'bold' },
    input: { fontFamily: baseFontFamily, backgroundColor: themeColors.background, color: themeColors.text, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16, borderWidth: 1, borderColor: themeColors.border, marginBottom: SPACING.medium },
    inputFocused: { borderColor: themeColors.primary, shadowColor: themeColors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 5 },
    textArea: { minHeight: 120, textAlignVertical: 'top', lineHeight: 22 },
    modalPickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: themeColors.background, borderRadius: 10, borderWidth: 1, borderColor: themeColors.border, paddingHorizontal: 15, height: 55, marginBottom: SPACING.medium },
    modalPickerButtonDisabled: { backgroundColor: themeColors.surfaceHighlight },
    modalPickerButtonText: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text },
    modalPickerButtonTextDisabled: { color: themeColors.textHint },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.7)' },
    modalContent: { backgroundColor: themeColors.surface, borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: SPACING.large, height: '75%', shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 20 },
    modalTitle: { fontFamily: baseFontFamily, fontSize: 24, fontWeight: 'bold', color: themeColors.text, marginBottom: SPACING.medium, textAlign: 'center' },
    modalSearchInput: { fontFamily: baseFontFamily, backgroundColor: themeColors.background, color: themeColors.text, borderRadius: 10, padding: 15, fontSize: 16, borderWidth: 1, borderColor: themeColors.border, marginBottom: SPACING.medium },
    listContainer: { flex: 1, width: '100%' },
    listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border },
    selectedListItem: { backgroundColor: themeColors.primaryLight + '30' },
    listItemText: { fontFamily: baseFontFamily, color: themeColors.text, fontSize: 17 },
    emptyListText: { textAlign: 'center', color: themeColors.textHint, marginTop: 30, fontSize: 16 },
    modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: SPACING.large },
    modalActionButton: { flex: 1, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginHorizontal: SPACING.small },
    modalDoneButton: { backgroundColor: themeColors.primary },
    modalDoneButtonText: { fontFamily: baseFontFamily, color: themeColors.text, fontSize: 17, fontWeight: 'bold' },
    modalCancelButton: { backgroundColor: themeColors.surfaceHighlight },
    modalCancelButtonText: { fontFamily: baseFontFamily, color: themeColors.text, fontSize: 17 },
    licensesContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: SPACING.medium, marginTop: SPACING.xsmall },
    licenseCheckbox: { flexDirection: 'row', alignItems: 'center', backgroundColor: themeColors.background, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 10, marginBottom: 10, marginRight: 10, borderWidth: 1, borderColor: themeColors.border },
    licenseCheckboxSelected: { borderColor: themeColors.primary, backgroundColor: themeColors.primary },
    licenseText: { fontFamily: baseFontFamily, fontSize: 16, color: themeColors.text },
    licenseTextSelected: { color: themeColors.background, fontWeight: '600' },
    jobTypeScrollContainer: { paddingBottom: 5 },
    jobTypeButton: { backgroundColor: themeColors.background, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, marginRight: 10, borderWidth: 1, borderColor: themeColors.border, justifyContent: 'center', alignItems: 'center' },
    jobTypeButtonSelected: { borderColor: themeColors.primary, backgroundColor: themeColors.primary },
    jobTypeText: { fontFamily: baseFontFamily, color: themeColors.text, fontSize: 15 },
    jobTypeTextSelected: { color: themeColors.background, fontWeight: 'bold' },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.small },
    helperText: { fontFamily: baseFontFamily, fontSize: 12, color: themeColors.textSecondary, marginTop: SPACING.xsmall },
    submitButton: { backgroundColor: themeColors.primary, paddingVertical: 18, borderRadius: 15, alignItems: 'center', marginTop: SPACING.xlarge, shadowColor: themeColors.primaryDark, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
    submitButtonText: { fontFamily: baseFontFamily, color: themeColors.text, fontSize: 19, fontWeight: 'bold' },
});