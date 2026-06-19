export interface Member {
    id: number | string;
    user_id: number | string;
    grade: number | string;
    role: number | string;
    isHoursComplete: boolean;
    created_at: Date;
}

export interface UpdateMemberDTO {
    grade?: string | number;
    role?: number | string;
    isHoursComplete?: boolean;
}