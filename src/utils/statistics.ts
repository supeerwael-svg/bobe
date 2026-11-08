import type { SchoolClass, Student } from '@/db/types';

export interface GenderCounts {
  boys: number;
  girls: number;
  total: number;
}

export interface ClassStatistics {
  classId: string;
  name: string;
  students: GenderCounts;
  halfBoarders: GenderCounts;
}

function emptyCounts(): GenderCounts {
  return { boys: 0, girls: 0, total: 0 };
}

function addStudent(counts: GenderCounts, student: Student): void {
  if (student.gender === 'male') counts.boys += 1;
  else counts.girls += 1;
  counts.total += 1;
}

export function isStudentActive(student: Student, today: string): boolean {
  return student.deletedAt === null && (student.leaveDate === null || student.leaveDate > today);
}

export function buildClassStatistics(classes: SchoolClass[], students: Student[], today: string): ClassStatistics[] {
  return classes.map((schoolClass) => {
    const stats: ClassStatistics = {
      classId: schoolClass.id,
      name: schoolClass.name,
      students: emptyCounts(),
      halfBoarders: emptyCounts(),
    };
    for (const student of students) {
      if (student.classId !== schoolClass.id || !isStudentActive(student, today)) continue;
      addStudent(stats.students, student);
      if (student.boardingStatus === 'half-boarder') addStudent(stats.halfBoarders, student);
    }
    return stats;
  });
}

export function sumClassStatistics(rows: ClassStatistics[]): Pick<ClassStatistics, 'students' | 'halfBoarders'> {
  const totals = { students: emptyCounts(), halfBoarders: emptyCounts() };
  for (const row of rows) {
    for (const group of ['students', 'halfBoarders'] as const) {
      totals[group].boys += row[group].boys;
      totals[group].girls += row[group].girls;
      totals[group].total += row[group].total;
    }
  }
  return totals;
}
