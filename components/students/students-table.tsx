import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StudentRow } from "@/lib/types";

interface StudentsTableProps {
  rows: StudentRow[];
}

const statusVariant: Record<StudentRow["status"], "success" | "warning" | "danger"> = {
  online: "success",
  break: "warning",
  offline: "danger"
};

export function StudentsTable({ rows }: StudentsTableProps) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
        Нет студентов для отображения.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead>Class</TableHead>
          <TableHead>Engagement</TableHead>
          <TableHead>Performance</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((student) => (
          <TableRow key={student.id}>
            <TableCell>
              <Link href={`/students/${student.id}`} className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{student.avatar}</AvatarFallback>
                </Avatar>
                <span className="font-medium hover:underline">{student.name}</span>
              </Link>
            </TableCell>
            <TableCell>{student.grade}</TableCell>
            <TableCell>{student.engagement}%</TableCell>
            <TableCell>{student.performance}%</TableCell>
            <TableCell>
              <Badge variant={statusVariant[student.status]}>{student.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
