package ma.fsbm.pfa.dermai.domain;

public enum Role {
    /** Manages users and sees all the activity. */
    ADMIN,
    /** Doctor: manages their patients and their analyses (account validated by an administrator). */
    DOCTOR,
    /** Patient / general public: their own analyses and the conversational assistant. */
    PATIENT
}
