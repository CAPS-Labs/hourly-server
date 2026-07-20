export interface Project {
    id: number | string;
    name: string;
    staffLead?: number | string;
    memberLead?: number | string;
    startDate: Date;
    endDate?: Date;
    isComplete: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateProjectDTO {
    name: string;
    staffLead?: number | string;
    memberLead?: number | string;
    startDate: Date;
    endDate?: Date;
    //should I include isComplete? But no newly created project can be complete
    //If I leave it out, will it break stuff?
}

export interface UpdateProjectDTO {
    name?: string;
    staffLead?: number | string;
    memberLead?: number | string;
    startDate?: Date;
    endDate?: Date;
    isComplete?: boolean;
}