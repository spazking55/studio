<template>

  <div>
    <slot :openFileDialog="openFileDialog" :handleFiles="handleFiles">
      <FileDropzone
        v-if="allowDrop"
        :disabled="readonly"
        @dropped="handleFiles"
        @click="openFileDialog"
      />
    </slot>
    <input
      v-if="!readonly"
      ref="fileUpload"
      style="display: none;"
      type="file"
      :accept="acceptedMimetypes"
      :multiple="allowMultiple"
      data-test="upload-dialog"
      @change="handleFiles($event.target.files)"
    >
    <Alert
      v-model="showUnsupportedFilesAlert"
      :header="$tr('unsupportedFilesHeader')"
      :text="unsupportedFilesText"
    />
    <Alert
      v-model="showTooLargeFilesAlert"
      :header="$tr('tooLargeFilesHeader')"
      :text="$tr('maxFileSizeText', {
        count: tooLargeFiles.length, size: formatFileSize(maxFileSize)
      })"
    />
    <Alert
      v-model="showStorageExceededAlert"
      :header="$tr('noStorageHeader')"
      text=""
    >
      <template v-slot>
        <div class="storage-alert">
          <p>{{ $tr('uploadSize', {size: formatFileSize(totalUploadSize)}) }}</p>
          <p>
            {{ $tr('remainingStorage', {size: formatFileSize(availableSpace)}) }}
          </p>
          <div class="storage-usage">
            <FileStorage />
          </div>
        </div>
      </template>
    </Alert>
  </div>

</template>

<script>

  import { mapActions, mapGetters } from 'vuex';
  import last from 'lodash/last';
  import partition from 'lodash/partition';
  import uniq from 'lodash/uniq';
  import flatMap from 'lodash/flatMap';

  import FileStorage from './FileStorage';
  import FileDropzone from './FileDropzone';
  import { MAX_FILE_SIZE } from 'shared/constants';
  import { fileSizeMixin } from 'shared/mixins';
  import Alert from 'shared/views/Alert';
  import { FormatPresetsList } from 'shared/leUtils/FormatPresets';

  export default {
    name: 'Uploader',
    components: {
      Alert,
      FileStorage,
      FileDropzone,
    },
    mixins: [fileSizeMixin],
    props: {
      readonly: {
        type: Boolean,
        default: false,
      },
      presetID: {
        type: String,
        required: false,
      },
      allowDrop: {
        type: Boolean,
        default: true,
      },
      allowMultiple: {
        type: Boolean,
        default: false,
      },
      displayOnly: {
        type: Boolean,
        default: false,
      },
    },
    data() {
      return {
        unsupportedFiles: [],
        tooLargeFiles: [],
        totalUploadSize: 0,
        showUnsupportedFilesAlert: false,
        showTooLargeFilesAlert: false,
        showStorageExceededAlert: false,
      };
    },
    computed: {
      ...mapGetters(['availableSpace']),
      acceptedFiles() {
        return FormatPresetsList.filter(fp =>
          this.presetID
            ? this.presetID === fp.id
            : !fp.supplementary && (!this.displayOnly || fp.display)
        );
      },
      acceptedMimetypes() {
        return flatMap(this.acceptedFiles, f => f.associated_mimetypes).join(',');
      },
      acceptedExtensions() {
        return uniq(flatMap(this.acceptedFiles, f => f.allowed_formats));
      },
      unsupportedFilesText() {
        return this.$tr('unsupportedFilesText', {
          count: this.unsupportedFiles.length,
          extensions: this.acceptedExtensions.join(this.$tr('listDelimiter')),
          extensionCount: this.acceptedExtensions.length,
        });
      },
      maxFileSize() {
        return MAX_FILE_SIZE;
      },
    },
    methods: {
      ...mapActions('file', ['uploadFile']),
      openFileDialog() {
        if (!this.readonly) {
          this.$refs.fileUpload.click();
        }
      },
      validateFiles(files) {
        // Get unsupported file types
        let partitionedFiles = partition(files, f =>
          this.acceptedExtensions.includes(last(f.name.split('.')).toLowerCase())
        );
        files = partitionedFiles[0];
        this.unsupportedFiles = partitionedFiles[1];

        // Get files that exceed the max file size
        partitionedFiles = partition(files, f => f.size < MAX_FILE_SIZE);
        files = partitionedFiles[0];
        this.tooLargeFiles = partitionedFiles[1];

        // Get the total file size
        this.totalUploadSize = files.reduce((sum, f) => {
          return sum + f.size;
        }, 0);
        return files;
      },
      handleFiles(files) {
        if (!this.readonly) {
          files = this.allowMultiple ? files : [files[0]];
          files = this.validateFiles(files);

          // Show errors if relevant
          if (this.totalUploadSize > this.availableSpace) {
            this.showStorageExceededAlert = true;
            return;
          } else if (this.unsupportedFiles.length) {
            this.showUnsupportedFilesAlert = true;
          } else if (this.tooLargeFiles.length) {
            this.showTooLargeFilesAlert = true;
          }
          return this.handleUploads(files).then(fileUploadObjects => {
            if (fileUploadObjects.length) {
              this.$emit(
                'uploading',
                this.allowMultiple ? fileUploadObjects : fileUploadObjects[0]
              );
            }
            return fileUploadObjects;
          });
        }
      },
      handleUploads(files) {
        // Catch any errors from file uploads and just
        // return null for the fileUploadObject if so
        return Promise.all(
          [...files].map(file => this.uploadFile({ file }).catch(() => null))
        ).then(fileUploadObjects => {
          // Make sure preset is getting set on files in case
          // need to distinguish between presets with same extension
          // (e.g. high res vs. low res videos)
          if (this.presetID) {
            fileUploadObjects.forEach(f => (f.preset = this.presetID));
          }

          // Filter out any null values here
          return fileUploadObjects.filter(Boolean);
        });
      },
    },
    $trs: {
      unsupportedFilesHeader: 'Unsupported files',
      unsupportedFilesText:
        '{count, plural,\n =1 {File}\n other {# files}} will not be uploaded.\n {extensionCount, plural,\n =1 {Accepted file type is}\n other {Accepted file types are}} {extensions}',
      listDelimiter: ', ',
      noStorageHeader: 'Not enough space',
      uploadSize: 'Upload is too large: {size}',
      remainingStorage: 'Remaining storage: {size}',
      tooLargeFilesHeader: 'Max file size exceeded',
      maxFileSizeText:
        '{count, plural,\n =1 {File}\n other {# files}} will not be uploaded. File size must be under {size}',
    },
  };

</script>

<style lang="less" scoped>

  .storage-alert {
    font-size: 12pt;
  }
  .storage-usage {
    margin-top: -5px;
    font-size: 10pt;
    color: gray;
  }

</style>
