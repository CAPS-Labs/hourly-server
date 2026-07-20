export interface Member {
    id: number | string;
    userId: number | string;
    grade: number | string;
    role: number | string;
    isHoursComplete: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface UpdateMemberDTO {
    grade?: string | number;
    role?: number | string;
    isHoursComplete?: boolean;
}