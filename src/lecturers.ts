import { FirebaseError } from 'firebase/app';
import { collection, doc, getDocs, orderBy, query, runTransaction } from 'firebase/firestore/lite';
import { db } from './firebase';

export type Lecturer = {
  IDGV: string;
  Fullname: string;
  Image: string;
  SumClass: number;
};

export type LecturerRecord = Lecturer & { id: string };

function lecturers() {
  if (!db) throw new Error('Điền cấu hình Firebase trong .env rồi khởi động lại Expo.');
  return collection(db, 'QLHocPhan', 'QuanLy', 'GiangVien');
}

export async function listLecturers(): Promise<LecturerRecord[]> {
  const snapshot = await getDocs(query(lecturers(), orderBy('IDGV')));
  return snapshot.docs.map(row => {
    const { IDGV, Fullname, Image, SumClass } = row.data();
    return { id: row.id, IDGV, Fullname, Image, SumClass };
  });
}

export async function saveLecturer(lecturer: Lecturer, editingId: string | null) {
  const entries = lecturers();
  const source = editingId === null ? null : doc(entries, editingId);
  const target = doc(entries, lecturer.IDGV);

  await runTransaction(entries.firestore, async transaction => {
    if (source && !(await transaction.get(source)).exists()) {
      throw new Error('Giảng viên không còn tồn tại. Hãy tải lại danh sách.');
    }
    if (source?.id !== target.id && (await transaction.get(target)).exists()) {
      throw new Error('Mã giảng viên đã tồn tại.');
    }
    transaction.set(target, lecturer);
    if (source && source.id !== target.id) transaction.delete(source);
  });
}

export async function deleteLecturer(id: string) {
  const entries = lecturers();
  const lecturer = doc(entries, id);
  await runTransaction(entries.firestore, async transaction => {
    if (!(await transaction.get(lecturer)).exists()) {
      throw new Error('Giảng viên không còn tồn tại. Hãy tải lại danh sách.');
    }
    transaction.delete(lecturer);
  });
}

export function firebaseMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error ? error.message : 'Đã xảy ra lỗi.';
  }

  switch (error.code) {
    case 'auth/invalid-email':
      return 'Email không hợp lệ.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email hoặc mật khẩu không đúng.';
    case 'auth/user-disabled':
      return 'Tài khoản đã bị vô hiệu hóa.';
    case 'auth/too-many-requests':
      return 'Đăng nhập quá nhiều lần. Vui lòng thử lại sau.';
    case 'auth/configuration-not-found':
    case 'auth/operation-not-allowed':
      return 'Hãy bật Email/Password trong Firebase Authentication.';
    case 'permission-denied':
      return 'Tài khoản chưa có quyền quản trị. Kiểm tra UID trong Firestore.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Không kết nối được Firebase. Kiểm tra mạng rồi thử lại.';
    default:
      return `Firebase báo lỗi (${error.code}). Kiểm tra cấu hình và thử lại.`;
  }
}
