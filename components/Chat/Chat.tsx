import {Conversation, ErrorMessage, KeyConfiguration, KeyValuePair, Message, OpenAIModel,} from '@/types';
import {throttle} from '@/utils';
import {IconClearAll, IconSettings} from '@tabler/icons-react';
import {useTranslation} from 'next-i18next';
import {FC, memo, MutableRefObject, useEffect, useRef, useState} from 'react';
import {ChatInput} from './ChatInput';
import {ChatLoader} from './ChatLoader';
import {ChatMessage} from './ChatMessage';
import {ErrorMessageDiv} from './ErrorMessageDiv';
import {ModelSelect} from './ModelSelect';
import {Upload} from "@/components/Chat/Upload";
import {CHAT_FILES_MAX_SIZE} from "@/utils/app/const";
import {humanFileSize} from "@/utils/app/files";

interface Props {
    conversation: Conversation;
    models: OpenAIModel[];
    keyConfiguration: KeyConfiguration;
    messageIsStreaming: boolean;
    modelError: ErrorMessage | null;
    messageError: boolean;
    loading: boolean;
    onSend: (message: Message, deleteCount?: number) => void;
    onUpdateConversation: (
        conversation: Conversation,
        data: KeyValuePair,
    ) => void;
    onEditMessage: (message: Message, messageIndex: number) => void;
    stopConversationRef: MutableRefObject<boolean>;
    handleKeyConfigurationValidation: () => boolean;
}

export const Chat: FC<Props> = memo(
    ({
         conversation,
         models,
         keyConfiguration,
         messageIsStreaming,
         modelError,
         loading,
         onSend,
         onUpdateConversation,
         onEditMessage,
         stopConversationRef,
         handleKeyConfigurationValidation,
     }) => {
        const {t} = useTranslation('chat');
        const [currentMessage, setCurrentMessage] = useState<Message>();
        const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
        const [showSettings, setShowSettings] = useState<boolean>(false);
        const [isUploading, setIsUploading] = useState<boolean>(false);
        const [errorMsg, setErrorMsg] = useState<string>();
        const [isUploadSuccess, setIsUploadSuccess] = useState(true);

        const messagesEndRef = useRef<HTMLDivElement>(null);
        const chatContainerRef = useRef<HTMLDivElement>(null);
        const textareaRef = useRef<HTMLTextAreaElement>(null);

        const handleIsUploading = (isUploading: boolean) => {
            setIsUploading(isUploading);
        }

        const handleIsUploadSuccess = (isUploadSuccess: boolean) => {
            setIsUploadSuccess(isUploadSuccess);
        }

        const handleUploadError = (errorMsg: string) => {
            setErrorMsg(errorMsg);
        }

        const onClearAll = () => {
            if (confirm(t<string>('Are you sure you want to clear all messages?'))) {
                onUpdateConversation(conversation, {key: 'messages', value: []});
            }
        };

        const scrollDown = () => {
            if (autoScrollEnabled) {
                messagesEndRef.current?.scrollIntoView(true);
            }
        };
        const throttledScrollDown = throttle(scrollDown, 250);

        useEffect(() => {
            throttledScrollDown();
            setCurrentMessage(
                conversation.messages[conversation.messages.length - 2],
            );
        }, [conversation.messages, throttledScrollDown]);

        useEffect(() => {
            const observer = new IntersectionObserver(
                ([entry]) => {
                    setAutoScrollEnabled(entry.isIntersecting);
                    if (entry.isIntersecting) {
                        textareaRef.current?.focus();
                    }
                },
                {
                    root: null,
                    threshold: 0.5,
                },
            );
            const messagesEndElement = messagesEndRef.current;
            if (messagesEndElement) {
                observer.observe(messagesEndElement);
            }
            return () => {
                if (messagesEndElement) {
                    observer.unobserve(messagesEndElement);
                }
            };
        }, [messagesEndRef]);

        return (
            <div className="overflow-none relative flex-1 bg-white dark:bg-[#343541]">
                {modelError ? (
                    <ErrorMessageDiv error={modelError}/>
                ) : (
                    <>
                        <div
                            className="max-h-full overflow-x-hidden"
                            ref={chatContainerRef}
                        >
                            {(
                                <>
                                    <div
                                        className="flex justify-center border border-b-neutral-300 bg-neutral-100 py-2 text-sm text-neutral-500 dark:border-none dark:bg-[#444654] dark:text-neutral-200">
                                        {t('Mahboub 2.0 (Demo)')}
                                        <IconClearAll
                                            className="ml-2 cursor-pointer hover:opacity-50"
                                            onClick={onClearAll}
                                            size={18}
                                        />
                                    </div>
                                    {showSettings && (
                                        <div className="mx-auto flex w-[200px] flex-col space-y-10 pt-8 sm:w-[300px]">
                                            <div
                                                className="flex h-full flex-col space-y-4 rounded border border-neutral-500 p-2">
                                                <ModelSelect
                                                    model={conversation.model}
                                                    models={models}
                                                    onModelChange={(model) =>
                                                        onUpdateConversation(conversation, {
                                                            key: 'model',
                                                            value: model,
                                                        })
                                                    }
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {conversation.messages.map((message, index) => (
                                        <ChatMessage
                                            key={index}
                                            message={message}
                                            messageIndex={index}
                                            onEditMessage={onEditMessage}
                                        />
                                    ))}

                                    {loading && <ChatLoader/>}

                                    <div
                                        className="h-[162px] bg-white dark:bg-[#343541]"
                                        ref={messagesEndRef}
                                    />
                                </>
                            )}
                        </div>

                        <ChatInput
                            stopConversationRef={stopConversationRef}
                            textareaRef={textareaRef}
                            messageIsStreaming={messageIsStreaming}
                            conversationIsEmpty={conversation.messages.length > 0}
                            model={conversation.model}
                            onSend={(message) => {
                                setCurrentMessage(message);
                                onSend(message);
                            }}
                            onRegenerate={() => {
                                if (currentMessage) {
                                    onSend(currentMessage, 2);
                                }
                            }}
                            handleKeyConfigurationValidation={handleKeyConfigurationValidation}
                        />
                    </>
                )}
            </div>
        );
    },
);
Chat.displayName = 'Chat';
