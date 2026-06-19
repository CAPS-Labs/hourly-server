export interface Project {
    id: number | string;
    name: string;
    staff_lead?: number | string;
    member_lead?: number | string;
    start_date: Date;
    end_date?: Date;
    isComplete: boolean;
    created_at: Date;
}

export interface CreateProjectDTO {
    name: string;
    staff_lead?: number | string;
    member_lead?: number | string;
    start_date: Date;
    end_date?: Date;
    //should I include isComplete? But no newly created project can be complete
    //If I leave it out, will it break stuff?
}

export interface UpdateProjectDTO {
    name?: string;
    staff_lead?: number | string;
    member_lead?: number | string;
    start_date?: Date;
    end_date?: Date;
    isComplete?: boolean;
}