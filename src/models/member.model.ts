export interface Member {
    id: number | string;
    userId: number | string;
    grade: number | string;
    role: number | string;
    isHoursComplete: boolean;
    createdAt: Date;
}

export interface UpdateMemberDTO {
    grade?: string | number;
    role?: number | string;
    isHoursComplete?: boolean;
}