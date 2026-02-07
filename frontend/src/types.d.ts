declare namespace PerPlexed {
    interface RecommendationShelf {
        title: string;
        libraryID: string;
        dir: string;
        link: string;
    }

    interface Status {
        ready: boolean;
        error: boolean;
        message: string;
    }

    interface Config {
        PLEX_SERVER: string;
        DEPLOYMENTID: string;
        CONFIG: ConfigOptions
    }

    interface ConfigOptions {
        DISABLE_PROXY: boolean; // DEPRECATED
        DISABLE_NEVU_SYNC: boolean;
    }

    namespace Sync {
        interface SocketError {
            type: string;
            message: string;
        }

        interface Ready {
            room: string;
            host: boolean;
        }

        interface PlayBackState {
            key?: string;
            state: string;
            time?: number;
        }

        interface Member {
            uid: string;
            socket: string;
            name: string;
            avatar: string;
        }
    }

    namespace WatchTogether {
        type PlaybackMode = "playing" | "paused";
        type ControlActionType = "setMedia" | "play" | "pause" | "seek" | "end";

        interface SocketError {
            type: string;
            message: string;
        }

        interface Member {
            uid: string;
            socket: string;
            name: string;
            avatar: string;
        }

        interface PlaybackState {
            key: string | null;
            state: PlaybackMode;
            positionMs: number;
            updatedAtMs: number;
        }

        interface Ready {
            room: string;
            host: boolean;
            seq: number;
            playback: PlaybackState;
        }

        interface ControlAction {
            actionId: string;
            actionType: ControlActionType;
            mediaKey?: string;
            positionMs?: number;
            state?: PlaybackMode;
            actorClientTs?: number;
        }

        interface StateUpdate {
            room: string;
            seq: number;
            actor: Member | null;
            actionType: ControlActionType | "sync";
            playback: PlaybackState;
        }
    }

    namespace Reviews {
        interface Review {
            itemID: string;
            userID: string;
            created_at: string;
            rating: number;
            message: string;
            spoilers: boolean;
            visibility: "GLOBAL" | "LOCAL";
            user: ReviewUser;
        }

        interface ReviewUser {
            id: string;
            username: string;
            avatar: string;
        }

        interface ReviewResponse {
            error?: string;
        }
    }
}
