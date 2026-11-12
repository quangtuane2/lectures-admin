import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { auth, firebaseConfigured } from './src/firebase';
import { deleteLecturer, firebaseMessage, listLecturers, LecturerRecord, saveLecturer } from './src/lecturers';

const emptyDraft = { IDGV: '', Fullname: '', Image: '', SumClass: '' };

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
};

function Button({ title, onPress, disabled, variant = 'primary' }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button, styles[variant], (disabled || pressed) && styles.dim,
      ]}
    >
      <Text style={[styles.buttonText, variant === 'primary' && styles.inverse, variant === 'danger' && styles.error]}>
        {title}
      </Text>
    </Pressable>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  disabled: boolean;
  secure?: boolean;
  keyboard?: 'email-address' | 'number-pad';
};

function Field({ label, value, onChangeText, disabled, secure, keyboard }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!disabled}
        keyboardType={keyboard}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function Admin() {
  const { width } = useWindowDimensions();
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [lecturers, setLecturers] = useState<LecturerRecord[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function clearDraft() {
    setDraft(emptyDraft);
    setEditing(null);
  }

  async function logout() {
    if (auth) await signOut(auth);
    setSignedIn(false);
    setLecturers([]);
    setQuery('');
    setDeleting(null);
    setNotice('');
    setError('');
    clearDraft();
  }

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (failure) {
      setError(firebaseMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function loadLecturers() {
    setLecturers(await listLecturers());
  }

  function login() {
    void run(async () => {
      if (!auth) throw new Error('Điền cấu hình Firebase trong .env rồi khởi động lại Expo.');
      if (!email.trim() || !password) throw new Error('Nhập email và mật khẩu.');
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
      try {
        await loadLecturers();
        setSignedIn(true);
      } catch (failure) {
        await signOut(auth);
        throw failure;
      }
    });
  }

  async function pickImage() {
    setError('');
    setNotice('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.65,
      });
      if (result.canceled) return;
      const { base64 } = result.assets[0];
      if (!base64 || base64.length > 4 * Math.ceil(700 * 1024 / 3)) {
        throw new Error('Chọn ảnh JPG, PNG, GIF hoặc WebP tối đa 700 KB.');
      }
      const format = base64.startsWith('/9j/') ? 'jpeg'
        : base64.startsWith('iVBOR') ? 'png'
          : base64.startsWith('R0lGOD') ? 'gif'
            : /^UklGR.{6}XRUJQ/.test(base64) ? 'webp' : null;
      if (!format) throw new Error('Ảnh cần có định dạng JPG, PNG, GIF hoặc WebP.');
      setDraft(previous => ({ ...previous, Image: `data:image/${format};base64,${base64}` }));
    } catch (failure) {
      setError(firebaseMessage(failure));
    }
  }

  function save() {
    void run(async () => {
      const IDGV = draft.IDGV.trim().toUpperCase();
      const Fullname = draft.Fullname.trim();
      const classCount = draft.SumClass.trim();
      const SumClass = Number(classCount);
      if (!/^[A-Z0-9][A-Z0-9_-]{0,29}$/.test(IDGV)) {
        throw new Error('Nhập mã giảng viên dài từ 1 đến 30 ký tự, dùng chữ cái, số, dấu gạch ngang hoặc gạch dưới.');
      }
      if (!Fullname || [...Fullname].length > 120) {
        throw new Error('Nhập họ và tên dài từ 1 đến 120 ký tự.');
      }
      if (!/^\d+$/.test(classCount) || !Number.isSafeInteger(SumClass)) {
        throw new Error('Nhập tổng số lớp là số nguyên không âm.');
      }
      if (!draft.Image) throw new Error('Chọn ảnh giảng viên.');

      await saveLecturer({ IDGV, Fullname, Image: draft.Image, SumClass }, editing);
      setNotice(editing === null ? 'Đã thêm giảng viên.' : 'Đã lưu thay đổi.');
      clearDraft();
      await loadLecturers();
    });
  }

  function edit(lecturer: LecturerRecord) {
    setError('');
    setNotice('');
    setDeleting(null);
    const { id, IDGV, Fullname, Image, SumClass } = lecturer;
    setEditing(id);
    setDraft({ IDGV, Fullname, Image, SumClass: String(SumClass) });
  }

  function remove(id: string) {
    void run(async () => {
      await deleteLecturer(id);
      if (editing === id) clearDraft();
      setDeleting(null);
      setNotice('Đã xóa giảng viên.');
      await loadLecturers();
    });
  }

  const searchTerm = query.trim().toLocaleLowerCase('vi');
  const visible = lecturers.filter(({ IDGV, Fullname }) =>
    IDGV.toLowerCase().includes(searchTerm) || Fullname.toLocaleLowerCase('vi').includes(searchTerm),
  );
  const feedback = (
    <>
      {!!error && <Text accessibilityRole="alert" style={[styles.feedback, styles.error]}>{error}</Text>}
      {!!notice && <Text accessibilityLiveRegion="polite" style={[styles.feedback, styles.success]}>{notice}</Text>}
    </>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Quản lý giảng viên</Text>
          {signedIn && <Button title="Đăng xuất" onPress={() => { void run(logout); }} variant="secondary" disabled={busy} />}
        </View>
        {!signedIn ? (
          <View style={[styles.panel, styles.login]}>
            <Text accessibilityRole="header" style={styles.heading}>Đăng nhập quản trị</Text>
            {!firebaseConfigured && <Text style={styles.error}>Điền cấu hình Firebase trong .env rồi khởi động lại Expo.</Text>}
            <Field label="Email" value={email} onChangeText={setEmail} disabled={busy} keyboard="email-address" />
            <Field label="Mật khẩu" value={password} onChangeText={setPassword} disabled={busy} secure />
            {feedback}
            <Button title={busy ? 'Đang đăng nhập…' : 'Đăng nhập'} onPress={login} disabled={busy || !firebaseConfigured} />
          </View>
        ) : (
          <View style={[styles.dashboard, width >= 920 && styles.columns]}>
            <View style={[styles.panel, width >= 920 && styles.editor]}>
              <Text accessibilityRole="header" style={styles.heading}>{editing === null ? 'Thêm giảng viên' : 'Sửa giảng viên'}</Text>
              <Field label="Mã giảng viên" value={draft.IDGV} onChangeText={IDGV => setDraft({ ...draft, IDGV })} disabled={busy} />
              <Field label="Họ và tên" value={draft.Fullname} onChangeText={Fullname => setDraft({ ...draft, Fullname })} disabled={busy} />
              <Field label="Tổng số lớp" value={draft.SumClass} onChangeText={SumClass => setDraft({ ...draft, SumClass })} disabled={busy} keyboard="number-pad" />
              {!!draft.Image && <Image accessibilityLabel="Ảnh xem trước" source={{ uri: draft.Image }} style={styles.preview} resizeMode="contain" />}
              <Button title={draft.Image ? 'Đổi ảnh' : 'Chọn ảnh'} onPress={pickImage} variant="secondary" disabled={busy} />
              {feedback}
              <View style={styles.row}>
                <Button title={busy ? 'Đang xử lý…' : editing === null ? 'Lưu giảng viên' : 'Lưu thay đổi'} onPress={save} disabled={busy} />
                {editing !== null && <Button title="Hủy sửa" onPress={clearDraft} variant="secondary" disabled={busy} />}
              </View>
            </View>
            <View style={[styles.panel, styles.catalog]}>
              <View style={styles.header}>
                <View style={styles.count}>
                  <Text accessibilityRole="header" style={styles.heading}>Danh sách giảng viên</Text>
                  <Text style={styles.muted}>{visible.length} / {lecturers.length} giảng viên</Text>
                </View>
                <Button title="Tải lại" onPress={() => { void run(loadLecturers); }} variant="secondary" disabled={busy} />
              </View>
              <TextInput
                accessibilityLabel="Tìm theo mã hoặc tên"
                onChangeText={setQuery}
                placeholder="Tìm theo mã hoặc tên"
                style={styles.input}
                value={query}
              />
              {!visible.length && (
                <Text style={styles.empty}>{query.trim() ? 'Không tìm thấy giảng viên phù hợp.' : 'Chưa có giảng viên.'}</Text>
              )}
              {visible.map(lecturer => (
                <View key={lecturer.id} style={styles.lecturer}>
                  <View style={styles.lecturerDetails}>
                    <Image accessibilityLabel={`Ảnh ${lecturer.Fullname}`} source={{ uri: lecturer.Image }} style={styles.thumbnail} />
                    <View style={styles.lecturerInfo}>
                      <Text style={styles.lecturerName}>{lecturer.Fullname}</Text>
                      <Text style={styles.muted}>Mã {lecturer.IDGV}</Text>
                      <Text style={styles.muted}>Tổng số lớp {lecturer.SumClass.toLocaleString('vi-VN')}</Text>
                    </View>
                  </View>
                  {deleting === lecturer.id ? (
                    <>
                      <Text style={styles.error}>Xóa “{lecturer.Fullname}” khỏi danh sách?</Text>
                      <View style={styles.row}>
                        <Button title="Xác nhận xóa" onPress={() => remove(lecturer.id)} variant="danger" disabled={busy} />
                        <Button title="Giữ lại" onPress={() => setDeleting(null)} variant="secondary" disabled={busy} />
                      </View>
                    </>
                  ) : (
                    <View style={styles.row}>
                      <Button title="Sửa" onPress={() => edit(lecturer)} variant="secondary" disabled={busy} />
                      <Button title="Xóa" onPress={() => setDeleting(lecturer.id)} variant="danger" disabled={busy} />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><Admin /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#edf2ef' },
  page: { width: '100%', maxWidth: 1160, alignSelf: 'center', padding: 20, paddingVertical: 32, gap: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.8, color: '#152d25' },
  heading: { fontSize: 21, fontWeight: '700', color: '#152d25' },
  dashboard: { gap: 18 },
  columns: { flexDirection: 'row', alignItems: 'flex-start' },
  panel: { backgroundColor: '#fff', borderColor: '#dce6df', borderWidth: 1, borderRadius: 16, gap: 14, padding: 20 },
  login: { width: '100%', maxWidth: 440, alignSelf: 'center', marginTop: 36 },
  editor: { width: 360 },
  catalog: { flex: 1, minWidth: 0 },
  count: { gap: 4 },
  field: { flex: 1, minWidth: 0, gap: 6 },
  label: { color: '#263c35', fontSize: 14, fontWeight: '600' },
  input: { minHeight: 44, borderWidth: 1, borderColor: '#bfcfc6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9, color: '#152d25', fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: '#174639', fontWeight: '700' },
  primary: { backgroundColor: '#18644f' },
  secondary: { backgroundColor: '#edf5ef' },
  danger: { backgroundColor: '#fff0ef' },
  inverse: { color: '#fff' },
  dim: { opacity: 0.6 },
  error: { color: '#a22923' },
  success: { color: '#17634e' },
  feedback: { fontSize: 14, lineHeight: 20 },
  muted: { color: '#4f665d', fontSize: 14 },
  empty: { color: '#4f665d', textAlign: 'center', paddingVertical: 22 },
  preview: { width: '100%', height: 150, borderRadius: 8, backgroundColor: '#f0f5f1' },
  lecturer: { gap: 10, borderTopWidth: 1, borderColor: '#e2eae5', paddingTop: 14 },
  lecturerDetails: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lecturerInfo: { flex: 1, gap: 4 },
  thumbnail: { width: 76, height: 76, borderRadius: 10, backgroundColor: '#edf2ef' },
  lecturerName: { fontSize: 17, fontWeight: '700', color: '#152d25' },
});
